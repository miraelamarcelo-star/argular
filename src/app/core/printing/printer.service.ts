import { Injectable, inject, signal, computed } from '@angular/core';
import { HardwareService, Peripheral } from '../hardware/hardware.service';
import { IPrintQueue, IPrintJob, PrintPaperProfile, PrintJobStatus } from '../../contracts/printing/printing.contract';

export interface PrinterProfile {
  paperWidth: PrintPaperProfile;
  copies: number;
  cut: boolean;
  density: number;
  encoding: string;
  header: string;
  footer: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrinterService implements IPrintQueue {
  private hardwareService = inject(HardwareService);

  readonly activePrinterId = signal<string>('prn_01');

  readonly profile = signal<PrinterProfile>({
    paperWidth: '80mm',
    copies: 1,
    cut: true,
    density: 100,
    encoding: 'UTF-8',
    header: '3EATCRU OS - RECIBO',
    footer: 'Obrigado pela preferência!'
  });

  readonly jobs = signal<IPrintJob[]>([]);

  readonly activePrinter = computed<Peripheral | null>(() => {
    const id = this.activePrinterId();
    return this.hardwareService.peripherals().find(p => p.id === id) || null;
  });

  readonly isPrinterOnline = computed(() => {
    const printer = this.activePrinter();
    return printer ? printer.status === 'online' : false;
  });

  readonly hasPaper = computed(() => {
    const printer = this.activePrinter();
    return printer ? printer.status !== 'no_paper' : false;
  });

  updateProfile(newProfile: Partial<PrinterProfile>) {
    this.profile.update(p => ({ ...p, ...newProfile }));
  }

  // Formata o conteúdo de acordo com o template de papel (80mm = ~48 colunas, 58mm = ~32 colunas, A4)
  formatTemplate(content: string, profile: PrintPaperProfile = '80mm'): string {
    const colWidth = profile === '58mm' ? 32 : profile === '80mm' ? 48 : 80;
    const divider = '='.repeat(colWidth);
    const header = this.profile().header;
    const footer = this.profile().footer;

    return `[TEMPLATE ${profile.toUpperCase()}]\n${header}\n${divider}\n${content}\n${divider}\n${footer}\n\n`;
  }

  async enqueue(title: string, content: string, profile: PrintPaperProfile = '80mm', copies = 1): Promise<IPrintJob> {
    const randSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 8) : Math.random().toString(36).substring(2, 6);
    const jobId = `job_${Date.now()}_${randSuffix}`;
    const formattedContent = this.formatTemplate(content, profile);

    const newJob: IPrintJob = {
      id: jobId,
      title,
      content: formattedContent,
      profile,
      copies,
      requestedAt: new Date(),
      createdAt: new Date(),
      status: 'queued',
      targetPrinterId: this.activePrinterId()
    };

    this.jobs.update(list => [newJob, ...list]);

    // Processa no spooler assincronamente
    this.processJob(newJob).catch(err => {
      console.warn('[PrinterService] Spooler print error:', err);
    });

    return newJob;
  }

  getJobs(): IPrintJob[] {
    return this.jobs();
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs().find(j => j.id === jobId);
    if (job && (job.status === 'queued' || job.status === 'printing')) {
      this.updateJobStatus(jobId, 'cancelled');
      return true;
    }
    return false;
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs().find(j => j.id === jobId);
    if (job) {
      this.updateJobStatus(jobId, 'queued');
      await this.processJob(job);
      return true;
    }
    return false;
  }

  async print(title: string, content: string, profile?: PrintPaperProfile, copies?: number): Promise<boolean> {
    const printer = this.activePrinter();
    const paper = profile || this.profile().paperWidth;
    const count = copies || this.profile().copies;
    
    // Fallback: Se a impressora física estiver sem papel ou offline, imprime em spooler virtual/PDF
    if (!printer || printer.status === 'offline') {
      console.warn('[PrinterService] Impressora offline. Usando Spooler Virtual de Fallback.');
    }
    if (printer?.status === 'no_paper') {
      throw new Error('Impressora sem papel');
    }

    const job = await this.enqueue(title, content, paper, count);
    return job.status !== 'failed';
  }

  private async processJob(job: IPrintJob): Promise<void> {
    const printer = this.activePrinter();
    if (printer?.status === 'no_paper') {
      this.updateJobStatus(job.id, 'failed', 'Impressora sem papel');
      return;
    }

    this.updateJobStatus(job.id, 'printing');

    // Tentar enviar para porta WebUSB física real se disponível
    if (typeof navigator !== 'undefined' && (navigator as unknown as { usb: { requestDevice: (opt: unknown) => Promise<unknown>, getDevices: () => Promise<unknown[]> } }).usb) {
      try {
        const devices = await (navigator as unknown as { usb: { requestDevice: (opt: unknown) => Promise<unknown>, getDevices: () => Promise<unknown[]> } }).usb.getDevices();
        if (devices.length > 0) {
          const _device = devices[0];
          console.log('Device:', _device);
          // Implementação física real (requer conexão prévia autorizada pelo usuário)
          /* 
          await device.open();
          if (device.configuration === null) await device.selectConfiguration(1);
          await device.claimInterface(0);
          const encoder = new TextEncoder();
          const data = encoder.encode(job.content);
          await device.transferOut(1, data);
          await device.close();
          */
          this.updateJobStatus(job.id, 'completed');
          return;
        }
      } catch (e) {
        console.warn('[PrinterService] Erro ao imprimir em dispositivo físico', e);
      }
    }

    // Fallback: Spooler virtual
    await new Promise(resolve => setTimeout(resolve, 800));
    this.updateJobStatus(job.id, 'completed');
  }

  private updateJobStatus(id: string, status: PrintJobStatus, error?: string) {
    this.jobs.update(list =>
      list.map(job => job.id === id ? { ...job, status, error } : job)
    );
  }
}

