import { Injectable, inject } from '@angular/core';
import { IOsDatabaseService, OsDatabaseNamespace, IOsDatabaseAdapter, OsQueryOptions, OsDatabaseTransaction, OS_DATABASE_ADAPTER } from '../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsDatabaseService implements IOsDatabaseService {
  private adapter: IOsDatabaseAdapter = inject(OS_DATABASE_ADAPTER);

  getNamespace(namespace: string): OsDatabaseNamespace {
    return {
      namespace,
      get: <T = unknown>(key: string) => this.adapter.get<T>(namespace, key),
      put: <T = unknown>(key: string, value: T) => this.adapter.put<T>(namespace, key, value),
      delete: (key: string) => this.adapter.delete(namespace, key),
      query: <T = unknown>(options?: OsQueryOptions) => this.adapter.query<T>(namespace, options),
      clear: () => this.adapter.clear(namespace),
      transaction: <R>(callback: (tx: OsDatabaseTransaction) => Promise<R>) => this.adapter.transaction<R>(namespace, callback)
    };
  }

  async migrate(): Promise<void> {
    await this.adapter.migrate();
  }

  async backup(): Promise<Blob | null> {
    return await this.adapter.backup();
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details: string; latencyMs: number }> {
    const start = performance.now();
    try {
      const ns = this.getNamespace('system.health');
      const testKey = `ping_${Date.now()}`;
      await ns.put(testKey, { ok: true, timestamp: new Date().toISOString() });
      const readBack = await ns.get<{ ok: boolean }>(testKey);
      await ns.delete(testKey);
      const latency = Math.round(performance.now() - start);

      if (readBack?.ok) {
        return {
          status: 'healthy',
          details: `${this.adapter.constructor.name} transacional ativo (Latência: ${latency}ms)`,
          latencyMs: latency
        };
      } else {
        return {
          status: 'degraded',
          details: 'Storage respondeu mas falhou na integridade de leitura imediata.',
          latencyMs: latency
        };
      }
    } catch (err) {
      return {
        status: 'error',
        details: `Erro crítico no storage do OS: ${err instanceof Error ? err.message : 'Falha desconhecida'}`,
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }
}
