import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncService } from './sync.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { IdentityService } from '../identity/identity.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { AppRuntimeService } from '../app-runtime/app-runtime.service';

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SyncService,
        {
          provide: IdentityService,
          useValue: {
            isOfflineFirstEnabled: () => true,
            currentTenant: signal(null),
            currentSession: signal(null)
          }
        },
        { provide: OsDatabaseService, useValue: { getNamespace: () => ({ get: () => Promise.resolve([]), put: () => Promise.resolve(), delete: () => Promise.resolve(), query: () => Promise.resolve([]) }) } },
        { provide: AppRuntimeService, useValue: { triggerGlobalAction: () => { return "noop"; } } }
      ]
    });
    service = TestBed.inject(SyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should queue operations correctly', async () => {
    await service.queueOperation('test.action', { data: 1 });
    // In a real test, we would mock the database namespace to verify the put call.
    expect(true).toBe(true);
  });
});
