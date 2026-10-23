import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowManagerService, WindowState } from '../../../../core/application/window-manager.service';
import { SyncService } from '../../../../core/sync/sync.service';
import { PrinterService } from '../../../../core/printing/printer.service';
import { HardwareService } from '../../../../core/hardware/hardware.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { IdentityService } from '../../../../core/identity/identity.service';
import { OperatorLockService } from '../../../../core/operator-lock/operator-lock.service';

export interface KernelServiceInfo {
  id: string;
  name: string;
  category: 'sync' | 'printer' | 'security' | 'diagnostics' | 'hardware';
  status: 'running' | 'idle' | 'warning';
  detail: string;
  icon: string;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      <!-- Header / Tabs -->
      <div class="h-12 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-1.5">
          <button 
            (click)="activeTab.set('processes')"
            [class]="activeTab() === 'processes' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">view_timeline</mat-icon>
            <span>Processos ({{ openWindows().length }})</span>
          </button>

          <button 
            (click)="activeTab.set('services')"
            [class]="activeTab() === 'services' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">memory</mat-icon>
            <span>Serviços do Kernel ({{ kernelServices().length }})</span>
          </button>

          <button 
            (click)="activeTab.set('performance')"
            [class]="activeTab() === 'performance' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'"
            class="px-3 py-1.5 rounded-lg text-xs border flex items-center gap-2 transition-all">
            <mat-icon class="text-[16px] leading-none">speed</mat-icon>
            <span>Desempenho & Recursos</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          @if (feedbackMessage()) {
            <span class="text-[11px] font-medium text-emerald-400 animate-fade-in flex items-center gap-1">
              <mat-icon class="text-[14px]">check_circle</mat-icon>
              {{ feedbackMessage() }}
            </span>
          }
          <button 
            (click)="refreshStats()" 
            title="Atualizar Estatísticas"
            class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors">
            <mat-icon class="text-[16px]">refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Tab 1: Processos (Janelas & Apps Abertos) -->
        @if (activeTab() === 'processes') {
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Janelas & Tarefas em Execução</h3>
                <p class="text-[11px] text-slate-500">Monitore aplicativos ativos e finalize processos quando necessário.</p>
              </div>

              @if (openWindows().length > 0) {
                <button 
                  (click)="terminateAllUserWindows()" 
                  class="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-all">
                  <mat-icon class="text-[15px]">close</mat-icon>
                  <span>Fechar Todos os Apps</span>
                </button>
              }
            </div>

            @if (openWindows().length === 0) {
              <div class="p-12 text-center border border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                <mat-icon class="text-4xl text-slate-600">desktop_windows</mat-icon>
                <p class="text-xs font-medium text-slate-400">Nenhum aplicativo ou janela aberta no momento.</p>
                <p class="text-[11px] text-slate-600">Inicie aplicativos pelo Menu Iniciar ou pelos atalhos da Área de Trabalho.</p>
              </div>
            } @else {
              <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 select-none">
                    <tr>
                      <th class="p-3">Aplicativo / Processo</th>
                      <th class="p-3">PID</th>
                      <th class="p-3">Status</th>
                      <th class="p-3">CPU</th>
                      <th class="p-3">Memória Est.</th>
                      <th class="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/60">
                    @for (win of openWindows(); track win.id) {
                      <tr class="hover:bg-slate-800/30 transition-colors">
                        <td class="p-3">
                          <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                              <mat-icon class="text-[16px]">{{ win.icon }}</mat-icon>
                            </div>
                            <div>
                              <div class="font-bold text-slate-200">{{ win.title }}</div>
                              <div class="text-[10px] font-mono text-slate-500">{{ win.id }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="p-3 font-mono text-slate-400">{{ getProcessPid(win.id) }}</td>
                        <td class="p-3">
                          @if (win.id === windowManager.topWindowId()) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Foco Ativo
                            </span>
                          } @else if (win.isMinimized) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-400 text-[10px] font-medium border border-slate-600/30">
                              Minimizado
                            </span>
                          } @else {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-medium border border-indigo-500/20">
                              Em Execução
                            </span>
                          }
                        </td>
                        <td class="p-3 font-mono text-slate-300">{{ getSimulatedCpu(win.id) }}%</td>
                        <td class="p-3 font-mono text-slate-300">{{ getSimulatedMem(win.id) }} MB</td>
                        <td class="p-3 text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            <button 
                              (click)="focusWindow(win.id)"
                              title="Trazer para frente"
                              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors">
                              Focar
                            </button>
                            <button 
                              (click)="killWindow(win.id, win.title)"
                              title="Encerrar Processo"
                              class="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-medium border border-rose-500/30 transition-colors">
                              Finalizar
                            </button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- Tab 2: Serviços do Kernel -->
        @if (activeTab() === 'services') {
          <div class="space-y-3">
            <div class="space-y-0.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Daemons & Subsistemas do Core OS</h3>
              <p class="text-[11px] text-slate-500">Módulos de infraestrutura essenciais executados em background.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (svc of kernelServices(); track svc.id) {
                <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <mat-icon class="text-[18px]">{{ svc.icon }}</mat-icon>
                    </div>
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-200">{{ svc.name }}</span>
                        <span 
                          [class]="svc.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : svc.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-700/40 text-slate-400 border-slate-600/30'"
                          class="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase border">
                          {{ svc.status === 'running' ? 'Operacional' : svc.status === 'warning' ? 'Alerta' : 'Ocioso' }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-400 leading-snug">{{ svc.detail }}</p>
                    </div>
                  </div>

                  <button 
                    (click)="triggerServiceAction(svc.id)"
                    class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold tracking-wider shrink-0 transition-colors border border-slate-700/60">
                    AÇÃO
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Tab 3: Desempenho & Recursos -->
        @if (activeTab() === 'performance') {
          <div class="space-y-4">
            <div class="space-y-0.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Telemetria & Consumo do Sistema</h3>
              <p class="text-[11px] text-slate-500">Métricas em tempo real de CPU, memória heap alocada e filas de eventos.</p>
            </div>

            <!-- Metric Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- CPU -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">CPU do Kernel</span>
                  <mat-icon class="text-indigo-400 text-base">speed</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ simulatedCpuUsage() }}%</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" [style.width.%]="simulatedCpuUsage()"></div>
                </div>
                <div class="text-[10px] text-slate-500">Carga do ciclo de renderização e despachos reativos</div>
              </div>

              <!-- Memory -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">Memória Heap</span>
                  <mat-icon class="text-emerald-400 text-base">memory</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ simulatedMemUsage() }} MB</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" [style.width.%]="(simulatedMemUsage() / 128) * 100"></div>
                </div>
                <div class="text-[10px] text-slate-500">Heap estimada em cache do browser (~128MB max)</div>
              </div>

              <!-- Active Threads / State -->
              <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                <div class="flex items-center justify-between text-slate-400">
                  <span class="text-xs font-bold uppercase">Sinais & Efeitos</span>
                  <mat-icon class="text-amber-400 text-base">sync_alt</mat-icon>
                </div>
                <div class="text-2xl font-black font-mono text-slate-100">{{ 24 + openWindows().length * 6 }}</div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-amber-500 h-full rounded-full transition-all duration-500" [style.width.%]="40 + openWindows().length * 8"></div>
                </div>
                <div class="text-[10px] text-slate-500">Subscrições reativas ativas no runtime</div>
              </div>
            </div>

            <!-- Maintenance Actions -->
            <div class="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-slate-200">Limpeza de Cache & Otimização do Runtime</div>
                <div class="text-[11px] text-slate-400">Libera buffers temporários de busca, compacta histórico de janelas e força coleta local.</div>
              </div>
              <button 
                (click)="optimizeMemory()" 
                class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all shrink-0">
                <mat-icon class="text-[16px]">cleaning_services</mat-icon>
                <span>Otimizar Memória</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class TaskManagerComponent {
  windowManager = inject(WindowManagerService);
  syncService = inject(SyncService);
  printerService = inject(PrinterService);
  hardwareService = inject(HardwareService);
  diagnosticsService = inject(DiagnosticsService);
  identityService = inject(IdentityService);
  operatorLockService = inject(OperatorLockService);

  activeTab = signal<'processes' | 'services' | 'performance'>('processes');
  feedbackMessage = signal<string>('');

  // Simulated metrics
  simulatedCpuUsage = signal<number>(6);
  simulatedMemUsage = signal<number>(44);

  // List open windows
  openWindows = computed<WindowState[]>(() => {
    return this.windowManager.windows().filter(w => w.isOpen);
  });

  // Services list
  kernelServices = computed<KernelServiceInfo[]>(() => {
    const isOnline = this.syncService.isOnline();
    const outboxLen = this.syncService.outbox().length;
    const isPrinterOn = this.printerService.isPrinterOnline();
    const printerJobs = this.printerService.jobs().length;
    const isLocked = this.operatorLockService.isLocked();

    return [
      {
        id: 'sync_daemon',
        name: 'Sync Worker Daemon',
        category: 'sync',
        status: isOnline ? (outboxLen > 5 ? 'warning' : 'running') : 'warning',
        detail: `Status: ${isOnline ? 'Online' : 'Offline'} | Fila Outbox: ${outboxLen} transações`,
        icon: isOnline ? 'cloud_done' : 'cloud_off'
      },
      {
        id: 'printer_spooler',
        name: 'Thermal Print Spooler',
        category: 'printer',
        status: isPrinterOn ? 'running' : 'warning',
        detail: `Status: ${isPrinterOn ? 'Pronta (80mm)' : 'Offline / Sem Papel'} | Fila: ${printerJobs} recibos`,
        icon: 'receipt_long'
      },
      {
        id: 'hardware_daemon',
        name: 'Hardware Interface Service',
        category: 'hardware',
        status: 'running',
        detail: 'Simulador de gaveta, impressora serial e leitor USB ativo',
        icon: 'devices_other'
      },
      {
        id: 'operator_lock_daemon',
        name: 'Operator Lock Daemon',
        category: 'security',
        status: isLocked ? 'warning' : 'running',
        detail: `Status de segurança: ${isLocked ? 'Terminal Travado' : 'Terminal Liberado'}`,
        icon: 'lock'
      },
      {
        id: 'diagnostics_daemon',
        name: 'System Diagnostics Service',
        category: 'diagnostics',
        status: 'running',
        detail: 'Auditoria contínua de memória, banco e rede',
        icon: 'health_and_safety'
      }
    ];
  });

  getProcessPid(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 9000) + 1000;
  }

  getSimulatedCpu(id: string): number {
    const isTop = id === this.windowManager.topWindowId();
    return isTop ? 4.2 : 0.4;
  }

  getSimulatedMem(id: string): number {
    const base = 12.5;
    let extra = 0;
    if (id === 'browser') extra = 18.2;
    if (id === 'app_pos') extra = 14.5;
    if (id === 'app_tables') extra = 9.8;
    return Number((base + extra).toFixed(1));
  }

  focusWindow(winId: string) {
    this.windowManager.focusWindow(winId);
    this.setFeedback('Janela trazida para o primeiro plano.');
  }

  killWindow(winId: string, title: string) {
    this.windowManager.closeWindow(winId);
    this.setFeedback(`Processo "${title}" encerrado.`);
  }

  terminateAllUserWindows() {
    const windows = this.openWindows();
    for (const win of windows) {
      if (win.id !== 'task_manager') {
        this.windowManager.closeWindow(win.id);
      }
    }
    this.setFeedback('Todos os aplicativos foram fechados.');
  }

  triggerServiceAction(svcId: string) {
    if (svcId === 'sync_daemon') {
      if (this.syncService.isOnline()) {
        this.syncService.sync().catch(err => console.warn('Sync failed:', err));
        this.setFeedback('Sincronização forçada enviada.');
      } else {
        this.syncService.toggleOnlineStatus();
        this.setFeedback('Modo online ativado.');
      }
    } else if (svcId === 'printer_spooler') {
      const current = this.printerService.activePrinter()?.status;
      const next = current === 'no_paper' ? 'online' : 'no_paper';
      this.hardwareService.updateStatus('prn_01', next);
      this.setFeedback(`Papel da impressora: ${next === 'online' ? 'Recarregado' : 'Esgotado'}`);
    } else if (svcId === 'operator_lock_daemon') {
      this.operatorLockService.lock();
      this.setFeedback('Terminal bloqueado.');
    } else if (svcId === 'diagnostics_daemon') {
      this.diagnosticsService.runDiagnostic();
      this.setFeedback('Auditoria de diagnósticos executada.');
    } else {
      this.setFeedback('Ação de serviço concluída.');
    }
  }

  optimizeMemory() {
    this.simulatedMemUsage.set(31);
    this.simulatedCpuUsage.set(2);
    this.setFeedback('Memória otimizada e buffers descarregados com sucesso!');
  }

  refreshStats() {
    this.simulatedCpuUsage.set(Math.floor(Math.random() * 6) + 3);
    this.setFeedback('Métricas atualizadas.');
  }

  private setFeedback(msg: string) {
    this.feedbackMessage.set(msg);
    setTimeout(() => {
      if (this.feedbackMessage() === msg) {
        this.feedbackMessage.set('');
      }
    }, 3500);
  }
}
