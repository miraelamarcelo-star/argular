import { TestBed } from '@angular/core/testing';
import { OsDatabaseService } from './os-database.service';
import { DeviceService } from '../device/device.service';
import { OS_DATABASE_ADAPTER, IOsDatabaseAdapter } from '../../contracts/os/os-database.contract';
import { IndexedDbDatabaseAdapter } from './adapters/indexeddb-database.adapter';
import { PlatformDatabaseAdapter } from './adapters/platform-database.adapter';
import { SqliteNativeAdapter } from './adapters/sqlite-native.adapter';
import { DevelopmentVirtualAdapter } from './adapters/development-virtual.adapter';

describe('OsDatabaseService', () => {
  let service: OsDatabaseService;
  let mockDeviceService: { deviceState: () => { platform: 'web' | 'windows' | 'android' } };

  beforeEach(() => {
    mockDeviceService = {
      deviceState: () => ({ platform: 'web' })
    };

    TestBed.configureTestingModule({
      providers: [
        OsDatabaseService,
        IndexedDbDatabaseAdapter,
        PlatformDatabaseAdapter,
        SqliteNativeAdapter,
        DevelopmentVirtualAdapter,
        {
          provide: OS_DATABASE_ADAPTER,
          useFactory: (device: DeviceService, native: PlatformDatabaseAdapter, indexed: IndexedDbDatabaseAdapter): IOsDatabaseAdapter => {
            const platform = device.deviceState().platform;
            return (platform === 'windows' || platform === 'android') ? native : indexed;
          },
          deps: [DeviceService, PlatformDatabaseAdapter, IndexedDbDatabaseAdapter]
        },
        { provide: DeviceService, useValue: mockDeviceService }
      ]
    });

    service = TestBed.inject(OsDatabaseService);
  });

  it('should be created and bind namespace correctly', () => {
    expect(service).toBeTruthy();
    const ns = service.getNamespace('test_ns');
    expect(ns).toBeTruthy();
  });

  it('should bind namespace correctly with CRUD methods', () => {
    const ns = service.getNamespace('test_ns');
    expect(ns).toBeTruthy();
    expect(typeof ns.get).toBe('function');
    expect(typeof ns.put).toBe('function');
    expect(typeof ns.delete).toBe('function');
  });
});
