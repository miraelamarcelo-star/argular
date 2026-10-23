import { TestBed } from '@angular/core/testing';
import { PlatformDatabaseAdapter } from './platform-database.adapter';
import { SqliteNativeAdapter } from './sqlite-native.adapter';
import { IndexedDbDatabaseAdapter } from './indexeddb-database.adapter';
import { DevelopmentVirtualAdapter } from './development-virtual.adapter';

describe('PlatformDatabaseAdapter (DatabaseAdapterResolver)', () => {
  let adapter: PlatformDatabaseAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlatformDatabaseAdapter,
        SqliteNativeAdapter,
        IndexedDbDatabaseAdapter,
        DevelopmentVirtualAdapter
      ]
    });
    adapter = TestBed.inject(PlatformDatabaseAdapter);
  });

  it('should be created', () => {
    expect(adapter).toBeTruthy();
  });

  it('should store and retrieve data', async () => {
    await adapter.put('testNs', 'key1', { value: 123 });
    const result = await adapter.get<{ value: number }>('testNs', 'key1');
    expect(result?.value).toBe(123);
  });

  it('should process cross-namespace transactions atomically', async () => {
    await adapter.transaction('ns1', async (tx) => {
      await tx.put('doc1', { v: 1 });
      await tx.put('doc2', { v: 2 }, 'ns2'); // cross-namespace
    });

    const r1 = await adapter.get<{ v: number }>('ns1', 'doc1');
    const r2 = await adapter.get<{ v: number }>('ns2', 'doc2');

    expect(r1?.v).toBe(1);
    expect(r2?.v).toBe(2);
  });

  it('should rollback transaction on error', async () => {
    try {
      await adapter.transaction('ns1', async (tx) => {
        await tx.put('doc3', { v: 3 });
        throw new Error('Abort transaction');
      });
    } catch (_e: unknown) { console.log(_e); }

    const r3 = await adapter.get<{ v: number }>('ns1', 'doc3');
    expect(r3).toBeNull(); // Should not exist due to rollback
  });
});
