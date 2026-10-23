import { TestBed } from '@angular/core/testing';
import { PrinterService } from './printer.service';
import { HardwareService } from '../hardware/hardware.service';

describe('PrinterService', () => {
  let service: PrinterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PrinterService,
        HardwareService
      ]
    });
    service = TestBed.inject(PrinterService);
  });

  it('should initialize with default profile and online status', () => {
    expect(service).toBeTruthy();
    expect(service.profile().paperWidth).toBe('80mm');
    expect(service.isPrinterOnline()).toBe(true);
    expect(service.hasPaper()).toBe(true);
  });

  it('should format templates according to paper profile', () => {
    const formatted = service.formatTemplate('Item: Cafe R$ 5,00', '80mm');
    expect(formatted).toContain('3EATCRU OS - RECIBO');
    expect(formatted).toContain('Item: Cafe R$ 5,00');
    expect(formatted).toContain('Obrigado pela preferência!');
  });

  it('should queue print jobs and update status', async () => {
    const success = await service.print('Cupom de Venda #1001', 'Venda Teste', '80mm', 1);

    expect(success).toBe(true);
    expect(service.jobs().length).toBeGreaterThan(0);
    const job = service.jobs().find(j => j.title === 'Cupom de Venda #1001');
    expect(job).toBeDefined();
    expect(job?.title).toBe('Cupom de Venda #1001');
  });
});
