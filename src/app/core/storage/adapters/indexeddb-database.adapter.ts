import { Injectable } from '@angular/core';
import { IOsDatabaseAdapter, OsDatabaseTransaction, OsQueryOptions } from '../../../contracts/os/os-database.contract';

const DB_NAME = '3eatcru_web_database';
const DB_VERSION = 1;
const STORE_NAME = 'os_namespaces_kv';

interface DbRecord {
  id: string; // `${namespace}::${key}`
  namespace: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * IndexedDB Database Adapter for Web Browser runtime environment.
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDbDatabaseAdapter implements IOsDatabaseAdapter {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<string, unknown>();

  constructor() {
    this.restoreMemoryFallback();
    this.initDatabase();
  }

  private restoreMemoryFallback(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('3eatcru_idb_memory_fallback_v1');
        if (raw) {
          const arr = JSON.parse(raw) as [string, unknown][];
          this.memoryFallback = new Map(arr);
        }
      } catch {
        // Ignore parse error
      }
    }
  }

  private persistMemoryFallback(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('3eatcru_idb_memory_fallback_v1', JSON.stringify(Array.from(this.memoryFallback.entries())));
      } catch {
        // Ignore quota error
      }
    }
  }

  private initDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('namespace', 'namespace', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private getCompositeKey(namespace: string, key: string): string {
    return `${namespace}::${key}`;
  }

  async get<T = unknown>(namespace: string, key: string): Promise<T | null> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);

    if (!db) {
      const val = this.memoryFallback.get(id);
      return val !== undefined ? (val as T) : null;
    }

    return new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as DbRecord | undefined;
        resolve(result ? (result.value as T) : null);
      };

      req.onerror = () => resolve(null);
    });
  }

  async put<T = unknown>(namespace: string, key: string, value: T): Promise<void> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);
    const record: DbRecord = {
      id,
      namespace,
      key,
      value,
      updatedAt: new Date().toISOString()
    };

    if (!db) {
      this.memoryFallback.set(id, value);
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(namespace: string, key: string): Promise<void> {
    const db = await this.initDatabase();
    const id = this.getCompositeKey(namespace, key);

    if (!db) {
      this.memoryFallback.delete(id);
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async query<T = unknown>(namespace: string, options?: OsQueryOptions): Promise<{ key: string; value: T }[]> {
    const db = await this.initDatabase();

    if (!db) {
      const prefix = `${namespace}::`;
      const matches: { key: string; value: T }[] = [];
      for (const [k, v] of this.memoryFallback.entries()) {
        if (k.startsWith(prefix)) {
          matches.push({ key: k.slice(prefix.length), value: v as T });
        }
      }
      return matches;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('namespace');
      const req = index.getAll(IDBKeyRange.only(namespace));

      req.onsuccess = () => {
        const records = (req.result as DbRecord[]) || [];
        let results = records.map(r => ({ key: r.key, value: r.value as T }));

        if (options?.filters) {
          results = results.filter(item => {
            return Object.entries(options.filters!).every(([k, v]) => {
              const valObj = item.value as Record<string, unknown>;
              return valObj && valObj[k] === v;
            });
          });
        }

        if (options?.offset) {
          results = results.slice(options.offset);
        }
        if (options?.limit) {
          results = results.slice(0, options.limit);
        }

        resolve(results);
      };

      req.onerror = () => resolve([]);
    });
  }

  async clear(namespace: string): Promise<void> {
    const db = await this.initDatabase();
    if (!db) {
      const prefix = `${namespace}::`;
      for (const k of Array.from(this.memoryFallback.keys())) {
        if (k.startsWith(prefix)) {
          this.memoryFallback.delete(k);
        }
      }
      this.persistMemoryFallback();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('namespace');
      const req = index.openCursor(IDBKeyRange.only(namespace));

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IndexedDB clear transaction aborted'));
    });
  }

  async transaction<R>(namespace: string, callback: (tx: OsDatabaseTransaction) => Promise<R>): Promise<R> {
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

    const result = await callback(tx);

    const db = await this.initDatabase();
    if (!db) {
      for (const item of stagedPuts) {
        this.memoryFallback.set(this.getCompositeKey(item.ns, item.key), item.val);
      }
      for (const item of stagedDeletes) {
        this.memoryFallback.delete(this.getCompositeKey(item.ns, item.key));
      }
      this.persistMemoryFallback();
      return result;
    }

    return new Promise<R>((resolve, reject) => {
      const idbTx = db.transaction(STORE_NAME, 'readwrite');
      const store = idbTx.objectStore(STORE_NAME);

      for (const item of stagedPuts) {
        const id = this.getCompositeKey(item.ns, item.key);
        const record: DbRecord = {
          id,
          namespace: item.ns,
          key: item.key,
          value: item.val,
          updatedAt: new Date().toISOString()
        };
        store.put(record);
      }

      for (const item of stagedDeletes) {
        const id = this.getCompositeKey(item.ns, item.key);
        store.delete(id);
      }

      idbTx.oncomplete = () => resolve(result);
      idbTx.onerror = () => reject(idbTx.error);
      idbTx.onabort = () => reject(new Error('IndexedDB Transaction aborted'));
    });
  }

  async migrate(): Promise<void> {
    await this.initDatabase();
  }

  async backup(): Promise<Blob | null> {
    const db = await this.initDatabase();
    if (!db) {
      const entries = Array.from(this.memoryFallback.entries());
      const backupPayload = {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        recordCount: entries.length,
        source: 'memory_fallback',
        records: entries.map(([compositeKey, val]) => {
          const parts = compositeKey.split('::');
          return {
            namespace: parts[0] || 'default',
            key: parts.slice(1).join('::'),
            value: val,
            updatedAt: new Date().toISOString()
          };
        })
      };
      return new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    }

    return new Promise<Blob | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const records = (req.result as DbRecord[]) || [];
          const backupPayload = {
            version: DB_VERSION,
            exportedAt: new Date().toISOString(),
            recordCount: records.length,
            source: 'indexeddb',
            records: records.map(r => ({
              namespace: r.namespace,
              key: r.key,
              value: r.value,
              updatedAt: r.updatedAt
            }))
          };
          const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
          resolve(blob);
        };

        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
}
