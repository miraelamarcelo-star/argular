import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DeviceService } from '../device/device.service';
import { IdentityService } from '../identity/identity.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { OsDatabaseNamespace } from '../../contracts/os/os-database.contract';
import { ISyncEngine, IConflictResolver } from '../../contracts/sync/sync.contract';
import { ConflictResolverService } from './conflict-resolver.service';

export interface OutboxOperation {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  action: string;
  payload: unknown;
  
  timestamp: string;
  status: 'pending' | 'processing' | 'failed' | 'dead_letter' | 'acknowledged';
  retryCount?: number;
  lastError?: string;
  nextRetryAt?: number;
}

interface SyncBatchResponse {
  success: boolean;
  processedCount: number;
  failedCount: number;
  serverTimestamp: string;
  acks: {
    opId: string;
    idempotencyKey: string;
    status: 'ACK' | 'DUPLICATE' | 'FAILED';
    error?: string;
    serverTimestamp: string;
  }[];
}

const MAX_OUTBOX_RETRIES = 5;
const MAX_BACKOFF_MS = 120000;

@Injectable({
  providedIn: 'root'
})
export class SyncService implements ISyncEngine {
  private http = inject(HttpClient);
  private deviceService = inject(DeviceService);
  private identityService = inject(IdentityService);
  private osDb = inject(OsDatabaseService);
  private conflictResolver = inject(ConflictResolverService);

  private customResolvers = new Map<string, IConflictResolver>();

  readonly syncStatus = signal<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  readonly lastSyncedAt = signal<Date | null>(new Date());
  readonly outbox = signal<OutboxOperation[]>([]);

  // 3-Level Connectivity Diagnostics
  readonly networkOnline = signal<boolean>(typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true);
  readonly serverReachable = signal<boolean>(true);
  readonly isOnline = computed(() => this.networkOnline() && this.serverReachable());
  readonly deadLetterCount = computed(() => this.outbox().filter(op => op.status === 'dead_letter').length);
  readonly syncHealthy = computed(() => this.syncStatus() !== 'error' && this.deadLetterCount() === 0 && this.isOnline());

  // Computados e getters de conformidade com ISyncEngine
  readonly pendingCountSignal = computed(() => this.outbox().filter(op => op.status === 'pending' || op.status === 'failed').length);
  readonly isSyncingSignal = computed(() => this.syncStatus() === 'syncing');

  get pendingCount(): number {
    return this.pendingCountSignal();
  }

  get isSyncing(): boolean {
    return this.isSyncingSignal();
  }

  private get syncDb(): OsDatabaseNamespace {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    return this.osDb.getNamespace(tenantId ? `tenant.${tenantId}.system.sync` : 'system.sync');
  }

  constructor() {
    // Listen to identity changes to reload outbox for the correct tenant
    effect(() => {
      // Trigger effect dependency when tenant changes
      this.identityService.currentTenant();
      this.loadPersistedOutbox();
    });

    if (typeof window !== 'undefined') {
      this.networkOnline.set(navigator.onLine ?? true);
      window.addEventListener('online', () => {
        this.networkOnline.set(true);
        this.sync().catch(err => console.warn('[SyncService] Auto-sync após reconexão falhou:', err));
      });
      window.addEventListener('offline', () => {
        this.networkOnline.set(false);
        this.syncStatus.set('idle');
      });
    }
  }

  private async loadPersistedOutbox(): Promise<void> {
    try {
      this.outbox.set([]); // Clear current outbox before loading new one
      const items = await this.syncDb.query<OutboxOperation>();
      const outboxItems = items.filter(i => i.key.startsWith('outbox_'));
      if (outboxItems.length > 0) {
        this.outbox.set(outboxItems.map(i => i.value));
      }
    } catch (err) {
      console.warn('[SyncService] Falha ao recuperar Outbox persistida:', err);
    }
  }

  registerConflictResolver<T>(entityName: string, resolver: IConflictResolver<T>): void {
    this.customResolvers.set(entityName, resolver as IConflictResolver);
  }

  getResolver(entityName: string): IConflictResolver {
    return this.customResolvers.get(entityName) || this.conflictResolver;
  }

  async queueOperation(action: string, payload: unknown): Promise<void> {
    const tenantId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!tenantId) {
      console.warn('[SyncService] Cannot queue operation without active tenant context');
      return;
    }

    const randSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 8) : Math.random().toString(36).substring(2, 7);
    const idempSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 12) : Math.random().toString(36).substring(2, 9);
    const newOp: OutboxOperation = {
      id: `op_${Date.now()}_${randSuffix}`,
      idempotencyKey: `idemp_${Date.now()}_${idempSuffix}`,
      tenantId,
      action,
      payload,
      
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    // Atualiza estado reativo e persiste na base local
    this.outbox.update(list => [...list, newOp]);
    await this.syncDb.put(`outbox_${newOp.id}`, newOp);
    this.syncStatus.set('idle');

    // Se estiver online, aciona a sincronização automática em segundo plano
    if (this.isOnline()) {
      this.sync().catch(err => console.warn('[SyncService] Auto-sync falhou, operação retida na outbox:', err));
    }
  }

  async sync(): Promise<void> {
    if (!this.isOnline()) {
      this.syncStatus.set('error');
      throw new Error('Sem conexão com a internet para sincronizar.');
    }

    const now = Date.now();
    const pendingOps = this.outbox().filter(op => 
      op.status === 'pending' || 
      (op.status === 'failed' && (!op.nextRetryAt || op.nextRetryAt <= now))
    );

    if (pendingOps.length === 0) {
      this.syncStatus.set('synced');
      return;
    }

    this.syncStatus.set('syncing');

    // Marcar operações como em processamento
    for (const op of pendingOps) {
      await this.updateOpStatus(op.id, 'processing');
    }

    try {
      // Envio real em lote para o endpoint canônico de sincronização da Central
      const activeCompanyId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
      const response = await firstValueFrom(
        this.http.post<SyncBatchResponse>('/api/v1/sync/batch', {
          companyId: activeCompanyId,
          operations: pendingOps
        })
      );

      if (response && response.acks) {
        this.serverReachable.set(true);
        for (const ack of response.acks) {
          if (ack.status === 'ACK' || ack.status === 'DUPLICATE') {
            await this.updateOpStatus(ack.opId, 'acknowledged');
            await this.removeOp(ack.opId);
          } else {
            const op = pendingOps.find(o => o.id === ack.opId);
            const isNonRecoverable = ack.error && (
              ack.error.toLowerCase().includes('unsupported') ||
              ack.error.toLowerCase().includes('invalid') ||
              ack.error.toLowerCase().includes('validation') ||
              ack.error.toLowerCase().includes('bad request')
            );

            if (isNonRecoverable) {
              console.error(`[SyncService] Operação ${ack.opId} rejeitada permanentemente devido a erro não-recuperável:`, ack.error);
              // Store in rejection logs in the local DB for audit/debugging instead of silent loss
              await this.syncDb.put(`sync_rejected_${ack.opId}`, {
                op,
                error: ack.error,
                rejectedAt: new Date().toISOString()
              });
              // Remove permanently from active outbox to unblock the queue
              await this.updateOpStatus(ack.opId, 'acknowledged');
              await this.removeOp(ack.opId);
            } else {
              const retryCount = ((op?.retryCount) || 0) + 1;
              if (retryCount >= MAX_OUTBOX_RETRIES) {
                console.warn(`[SyncService] Operação ${ack.opId} atingiu o limite de ${MAX_OUTBOX_RETRIES} tentativas. Movendo para Dead-Letter Queue.`);
                await this.moveToDeadLetter(ack.opId, ack.error || 'Limite de tentativas excedido', retryCount);
              } else {
                const backoffMs = this.calculateBackoffWithJitter(retryCount);
                await this.updateOpFailure(ack.opId, ack.error || 'Erro no servidor', retryCount, Date.now() + backoffMs);
              }
            }
          }
        }
      }

      const hasFailures = this.outbox().some(op => op.status === 'failed');
      this.syncStatus.set(hasFailures ? 'error' : 'synced');
      this.lastSyncedAt.set(new Date());
    } catch (err) {
      this.serverReachable.set(false);
      const errorMsg = err instanceof Error ? err.message : String(err);
      for (const op of pendingOps) {
        const retryCount = (op.retryCount || 0) + 1;
        if (retryCount >= MAX_OUTBOX_RETRIES) {
          await this.moveToDeadLetter(op.id, errorMsg, retryCount);
        } else {
          const backoffMs = this.calculateBackoffWithJitter(retryCount);
          await this.updateOpFailure(op.id, errorMsg, retryCount, Date.now() + backoffMs);
        }
      }
      this.syncStatus.set('error');
    }
  }

  private calculateBackoffWithJitter(retryCount: number): number {
    const baseBackoff = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
    // Full jitter between 0.75 and 1.25 of base backoff to prevent thundering herd
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.round(baseBackoff * jitterFactor);
  }

  toggleOnlineStatus() {
    this.networkOnline.update(status => !status);
    if (!this.networkOnline()) {
      this.syncStatus.set('idle');
    }
  }

  private async moveToDeadLetter(id: string, error: string, retryCount: number): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status: 'dead_letter', lastError: error, retryCount } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
      await this.syncDb.put(`sync_deadletter_${id}`, {
        op,
        failedAt: new Date().toISOString(),
        error,
        retryCount
      });
    }
  }

  private async updateOpStatus(id: string, status: 'pending' | 'processing' | 'failed' | 'acknowledged'): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
    }
  }

  private async updateOpFailure(id: string, error: string, retryCount: number, nextRetryAt: number): Promise<void> {
    this.outbox.update(list =>
      list.map(op => op.id === id ? { ...op, status: 'failed', lastError: error, retryCount, nextRetryAt } : op)
    );
    const op = this.outbox().find(o => o.id === id);
    if (op) {
      await this.syncDb.put(`outbox_${id}`, op);
    }
  }

  private async removeOp(id: string): Promise<void> {
    this.outbox.update(list => list.filter(op => op.id !== id));
    await this.syncDb.delete(`outbox_${id}`);
  }
}

