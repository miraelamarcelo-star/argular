import { Injectable } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';

export interface SqliteBridge {
  executeSql(query: string, params: unknown[]): Promise<{ rows: unknown[]; rowsAffected: number }>;
}

/**
 * SQLiteNativeAdapter
 * Strictly communicates with the native host OS database engine via binary bridge (Windows/Android).
 * Executes genuine, server-authoritative/device-authoritative SQL with ACID transactions.
 */
@Injectable({
  providedIn: 'root'
})
export class SqliteNativeAdapter implements IOsDatabaseAdapter {
  private isInitialized = false;
  private nativeBridge: SqliteBridge | null = null;

  constructor() {
    this.initSqliteBridge();
  }

  private initSqliteBridge(): void {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { sqliteBridge?: SqliteBridge; electronAPI?: { sqlite?: SqliteBridge } };
      this.nativeBridge = win.sqliteBridge || win.electronAPI?.sqlite || null;
    }
  }

  private async ensureInitialized(): Promise<SqliteBridge> {
    if (!this.nativeBridge) {
      throw new Error('[SQLiteNativeAdapter] CRITICAL: Native SQLite binary bridge not detected on this runtime platform.');
    }

    if (this.isInitialized) return this.nativeBridge;

    // Build the atomic local relational table structure
    await this.nativeBridge.executeSql(`
      CREATE TABLE IF NOT EXISTS os_kv (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );
    `, []);

    await this.nativeBridge.executeSql(`CREATE INDEX IF NOT EXISTS idx_os_kv_ns ON os_kv(namespace);`, []);
    this.isInitialized = true;
    return this.nativeBridge;
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT value FROM os_kv WHERE namespace = ? AND key = ? LIMIT 1', [namespace, key]);
    if (!result.rows || result.rows.length === 0) return null;
    
    try {
      const valStr = (result.rows[0] as Record<string, unknown>)['value'] as string;
      return JSON.parse(valStr) as T;
    } catch {
      return (result.rows[0] as Record<string, unknown>)['value'] as T;
    }
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    const bridge = await this.ensureInitialized();
    const serialized = JSON.stringify(value);
    const now = new Date().toISOString();
    await bridge.executeSql(
      'INSERT OR REPLACE INTO os_kv (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)',
      [namespace, key, serialized, now]
    );
  }

  async delete(namespace: string, key: string): Promise<void> {
    const bridge = await this.ensureInitialized();
    await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ? AND key = ?', [namespace, key]);
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT key, value FROM os_kv WHERE namespace = ?', [namespace]);
    if (!result.rows) return [];

    let items = (result.rows as Record<string, unknown>[]).map(r => {
      let parsed: T;
      try {
        parsed = JSON.parse(r['value'] as string);
      } catch {
        parsed = r['value'] as T;
      }
      return { key: r['key'] as string, value: parsed };
    });

    if (options?.filters) {
      items = items.filter(item => {
        return Object.entries(options.filters!).every(([k, v]) => {
          const valObj = item.value as Record<string, unknown>;
          return valObj && valObj[k] === v;
        });
      });
    }

    if (options?.offset) {
      items = items.slice(options.offset);
    }
    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  async clear(namespace: string): Promise<void> {
    const bridge = await this.ensureInitialized();
    await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ?', [namespace]);
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
    const bridge = await this.ensureInitialized();
    
    // SQLite atomic sequence initiation
    await bridge.executeSql('BEGIN TRANSACTION;', []);
    
    const stagedPuts: { ns: string; key: string; val: unknown }[] = [];
    const stagedDeletes: { ns: string; key: string }[] = [];

    const tx: OsDatabaseTransaction = {
      get: async <T>(key: string, overrideNs?: string): Promise<T | null> => {
        const targetNs = overrideNs || namespace;
        const putMatch = stagedPuts.find(p => p.ns === targetNs && p.key === key);
        if (putMatch) return putMatch.val as T;

        const isDeleted = stagedDeletes.some(d => d.ns === targetNs && d.key === key);
        if (isDeleted) return null;

        return this.get<T>(targetNs, key);
      },
      put: async <T>(key: string, value: T, overrideNs?: string): Promise<void> => {
        const targetNs = overrideNs || namespace;
        stagedPuts.push({ ns: targetNs, key, val: value });
      },
      delete: async (key: string, overrideNs?: string): Promise<void> => {
        const targetNs = overrideNs || namespace;
        stagedDeletes.push({ ns: targetNs, key });
      }
    };

    try {
      const result = await callback(tx);

      // Perform staging execution inside the single native transaction context
      for (const item of stagedPuts) {
        const serialized = JSON.stringify(item.val);
        const now = new Date().toISOString();
        await bridge.executeSql(
          'INSERT OR REPLACE INTO os_kv (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)',
          [item.ns, item.key, serialized, now]
        );
      }

      for (const item of stagedDeletes) {
        await bridge.executeSql('DELETE FROM os_kv WHERE namespace = ? AND key = ?', [item.ns, item.key]);
      }

      await bridge.executeSql('COMMIT;', []);
      return result;
    } catch (error) {
      try {
        await bridge.executeSql('ROLLBACK;', []);
      } catch {
        // Suppress nested rollback exceptions
      }
      throw error;
    }
  }

  async migrate(): Promise<void> {
    await this.ensureInitialized();
  }

  async backup(): Promise<Blob | null> {
    const bridge = await this.ensureInitialized();
    const result = await bridge.executeSql('SELECT namespace, key, value FROM os_kv', []);
    if (!result.rows) return null;

    const allRecords = result.rows.map(r => {
      const record = r as Record<string, unknown>;
      let parsed: unknown;
      try {
        parsed = JSON.parse(record['value'] as string);
      } catch {
        parsed = record['value'];
      }
      return { namespace: record['namespace'], key: record['key'], value: parsed };
    });

    return new Blob([JSON.stringify(allRecords, null, 2)], { type: 'application/json' });
  }
}
