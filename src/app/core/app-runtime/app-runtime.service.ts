import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OsContext, OsPrintOptions } from '../../contracts/os/os-context.contract';
import { OsDatabaseService } from '../storage/os-database.service';
import { PrinterService } from '../printing/printer.service';
import { SyncService } from '../sync/sync.service';
import { OsEventBusService } from '../events/event-bus.service';
import { HardwareService } from '../hardware/hardware.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { DeviceService } from '../device/device.service';
import { AppRegistryService } from './app-registry.service';
import { AppAccessService } from './app-access.service';
import { IdentityService } from '../identity/identity.service';
import { OsStateService } from '../../os-state.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { OperatorLockService } from '../operator-lock/operator-lock.service';
import { AppLifecycleState } from '../../contracts/apps/app-instance.contract';
import { ClientApiClient, RequestOptions } from '../api/api-client';
import { HttpRequestOptions, NetworkStatus } from '../../contracts/network/network.contract';

export interface RunningAppInstance {
  appId: string;
  state: AppLifecycleState;
  startedAt: Date;
  lastActiveAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AppRuntimeService {
  private osDb = inject(OsDatabaseService);
  private printerService = inject(PrinterService);
  private syncService = inject(SyncService);
  private eventBus = inject(OsEventBusService);
  private hardwareService = inject(HardwareService);
  private diagnosticsService = inject(DiagnosticsService);
  private deviceService = inject(DeviceService);
  private appRegistry = inject(AppRegistryService);
  private appAccess = inject(AppAccessService);
  private identityService = inject(IdentityService);
  private osState = inject(OsStateService);
  private configService = inject(ConfigurationService);
  private operatorLockService = inject(OperatorLockService);
  private apiClient = inject(ClientApiClient);

  // Monitoramento de instâncias e ciclos de vida em execução no OS
  private runningInstances = signal<Map<string, RunningAppInstance>>(new Map());

  // Hook para emissão de notificações globais do Shell
  onNotification?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  // Hook para abertura de janelas
  onOpenAppRequest?: (targetAppId: string, title?: string) => void;

  private checkPermission(appId: string, requiredPermission: string): boolean {
    const hasPerm = this.appAccess.isPermissionGranted(appId, requiredPermission);
    if (!hasPerm) {
      this.diagnosticsService.warn(`[Permission Engine] App '${appId}' negado ao acessar recurso '${requiredPermission}'.`);
    }
    return hasPerm;
  }

  validateAppCompatibility(appId: string): { compatible: boolean; reason?: string } {
    return this.appAccess.validateCompatibility(appId);
  }

  checkEntitlement(appId: string): boolean {
    const result = this.appAccess.canLaunchApp(appId);
    return result.allowed;
  }

  createContext(appId: string, companyId: string, companyName: string, branchId?: string, branchName?: string): OsContext {
    const access = this.appAccess.canLaunchApp(appId);
    if (!access.allowed) {
      this.diagnosticsService.error(`[AppRuntime] Bloqueio de segurança ao inicializar '${appId}': ${access.reason}`);
      throw new Error(`[Security] Execução de '${appId}' negada: ${access.reason}`);
    }

    const storageNamespace = this.osDb.getNamespace(`tenant.${companyId}.app.${appId}`);
    const syncService = this.syncService;

    // Registra início do ciclo de vida
    this.updateInstanceState(appId, 'active');

    return {
      appId,
      companyId,
      companyName,
      branchId,
      branchName,
      operatorName: this.operatorLockService.activeOperator()?.name || 'Operador',
      isOnline: this.syncService.isOnline(),
      storage: storageNamespace,
      events: this.eventBus,

      hardware: {
        readScale: async (scaleId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para ler balança.`);
          }
          return this.hardwareService.readScale(scaleId);
        },
        triggerCashDrawer: async (drawerId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para abrir gaveta.`);
          }
          return this.hardwareService.triggerCashDrawer(drawerId);
        },
        sendCustomerDisplay: async (line1: string, line2?: string, displayId?: string) => {
          if (!this.checkPermission(appId, 'hardware')) {
            throw new Error(`[Security] App '${appId}' não tem permissão 'hardware' para acionar display.`);
          }
          return this.hardwareService.sendCustomerDisplay(line1, line2, displayId);
        },
        listPeripherals: async () => {
          if (!this.checkPermission(appId, 'hardware')) {
            return [];
          }
          return this.hardwareService.listPeripherals();
        }
      },

      sync: {
        isOnline: this.syncService.isOnline(),
        queueOperation: async (action: string, payload: unknown) => {
          await this.syncService.queueOperation(action, payload);
        }
      },

      network: {
        connectivity: {
          get status(): NetworkStatus {
            return {
              isOnline: syncService.isOnline(),
              type: typeof navigator !== 'undefined' && 'connection' in navigator ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType as unknown as NetworkStatus['type'] || 'unknown' : 'unknown',
              lastCheckedAt: syncService.lastSyncedAt() || new Date()
            };
          },
          isOnline: () => syncService.isOnline(),
          onStatusChange: (callback: (status: NetworkStatus) => void) => {
            const handleOnline = () => callback({ isOnline: true, lastCheckedAt: new Date() });
            const handleOffline = () => callback({ isOnline: false, lastCheckedAt: new Date() });
            if (typeof window !== 'undefined') {
              window.addEventListener('online', handleOnline);
              window.addEventListener('offline', handleOffline);
              return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
              };
            }
            return () => undefined;
          },
          checkConnection: async () => {
            await syncService.sync();
            return syncService.isOnline();
          }
        },
        http: {
          get: async <T = unknown>(url: string, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.get<T>(url, options as unknown as RequestOptions)),
          post: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.post<T>(url, body, options as unknown as RequestOptions)),
          put: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.put<T>(url, body, options as unknown as RequestOptions)),
          patch: async <T = unknown>(url: string, body: unknown, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.patch<T>(url, body, options as unknown as RequestOptions)),
          delete: async <T = unknown>(url: string, options?: HttpRequestOptions) => 
            firstValueFrom(this.apiClient.delete<T>(url, options as unknown as RequestOptions))
        }
      },

      logger: {
        info: (message: string, context?: Record<string, unknown>) =>
          this.diagnosticsService.info(`[${appId}] ${message}`, context),
        warn: (message: string, context?: Record<string, unknown>) =>
          this.diagnosticsService.warn(`[${appId}] ${message}`, context),
        error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
          this.diagnosticsService.error(`[${appId}] ${message}`, error, context)
      },

      config: {
        get: (key: string) => this.configService.get(key, 'COMPANY')
      },

      print: async (title: string, content: string, options?: OsPrintOptions): Promise<boolean> => {
        if (!this.checkPermission(appId, 'printer')) {
          if (this.onNotification) {
            this.onNotification('Permissão Negada', `O aplicativo '${appId}' não possui permissão para emitir impressões.`, 'error');
          }
          return false;
        }
        return this.printerService.print(title, content, options?.profile, options?.copies);
      },

      notify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        if (!this.checkPermission(appId, 'notifications')) {
          console.warn(`[Permission Engine] App '${appId}' tentou emitir notificação sem permissão.`);
          return;
        }
        if (this.onNotification) {
          this.onNotification(title, message, type);
        } else {
          console.log(`[OS Notification] [${type.toUpperCase()}] ${title}: ${message}`);
        }
      },

      openApp: (targetAppId: string, title?: string) => {
        if (this.onOpenAppRequest) {
          this.onOpenAppRequest(targetAppId, title);
        }
      }
    };
  }

  updateInstanceState(appId: string, state: AppLifecycleState): void {
    this.runningInstances.update(map => {
      const updated = new Map(map);
      const existing = updated.get(appId);
      const now = new Date();
      if (state === 'destroyed') {
        updated.delete(appId);
      } else {
        updated.set(appId, {
          appId,
          state,
          startedAt: existing ? existing.startedAt : now,
          lastActiveAt: now
        });
      }
      return updated;
    });

    this.eventBus.publish('os.app.lifecycle', { appId, state });
  }

  getRunningApps(): RunningAppInstance[] {
    return Array.from(this.runningInstances().values());
  }

  getAppState(appId: string): AppLifecycleState {
    return this.runningInstances().get(appId)?.state || 'unmounted';
  }
}

