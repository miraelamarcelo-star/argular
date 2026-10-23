import { HardwareService } from './hardware.service';

describe('HardwareService', () => {
  let service: HardwareService;

  beforeEach(() => {
    service = new HardwareService();
  });

  it('should initialize with default peripheral list', () => {
    expect(service).toBeTruthy();
    expect(service.peripherals().length).toBeGreaterThan(0);
    const printer = service.peripherals().find(p => p.type === 'printer');
    expect(printer).toBeDefined();
    expect(printer?.status).toBe('online');
  });

  it('should allow registering and updating peripheral status', () => {
    service.registerPeripheral({
      id: 'custom_pinpad_01',
      name: 'PinPad Gertec PPC930',
      type: 'scanner',
      status: 'online',
      port: 'USB002'
    });

    expect(service.peripherals().some(p => p.id === 'custom_pinpad_01')).toBe(true);

    service.updateStatus('custom_pinpad_01', 'offline');
    const updated = service.peripherals().find(p => p.id === 'custom_pinpad_01');
    expect(updated?.status).toBe('offline');

    service.unregisterPeripheral('custom_pinpad_01');
    expect(service.peripherals().some(p => p.id === 'custom_pinpad_01')).toBe(false);
  });

  it('should provide simulated scale readings', async () => {
    const reading = await service.readScale();
    expect(reading).toBeDefined();
    expect(typeof reading.weightKg).toBe('number');
    expect(typeof reading.isStable).toBe('boolean');
  });
});
