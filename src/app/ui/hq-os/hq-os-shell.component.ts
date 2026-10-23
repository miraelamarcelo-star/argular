import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HqStateService } from './hq-state.service';
import { IdentityService } from '../../core/identity/identity.service';
import { OsDisplayEngineService } from '../../core/application/display-engine.service';
import { HqDisplaySettingsModalComponent } from './components/hq-display-settings-modal.component';

@Component({
  selector: 'app-hq-os-shell',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterOutlet, RouterLink, RouterLinkActive, HqDisplaySettingsModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Login Overlay -->
    @if (!hqState.isLoggedIn()) {
      <div class="h-screen w-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 flex flex-col items-center justify-center font-sans">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div class="flex justify-center mb-6">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <mat-icon class="text-white text-3xl w-8 h-8 flex items-center justify-center">admin_panel_settings</mat-icon>
            </div>
          </div>
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-white tracking-tight">3EATCRU HQ OS</h1>
            <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">Control Plane Admin</p>
          </div>
          <form (submit)="onLoginSubmit($event)" class="space-y-4">
            <div>
              <label for="adminEmail" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail Administrativo</label>
              <input id="adminEmail" type="email" [value]="adminEmail()" (input)="onEmailInput($event)" placeholder="admin@3eatcru.com" 
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600">
            </div>
            <div>
              <label for="adminPassword" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Senha</label>
              <input id="adminPassword" type="password" [value]="adminPassword()" (input)="onPasswordInput($event)" placeholder="••••••••" 
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600">
            </div>
            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2 mt-2">
              <mat-icon class="text-sm">login</mat-icon>
              Acessar HQ OS
            </button>
          </form>
        </div>
      </div>
    } @else {
      <div class="h-screen w-screen bg-slate-950 text-slate-300 flex overflow-hidden font-sans selection:bg-indigo-500/30">
        <!-- HQ OS Kernel Sidebar (Dock) -->
        <aside class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 shadow-2xl z-20">
          <div class="p-6 border-b border-slate-800 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <mat-icon class="text-white text-lg w-5 h-5 flex items-center justify-center">admin_panel_settings</mat-icon>
            </div>
            <div>
              <h1 class="text-sm font-bold text-white tracking-tight">3EATCRU HQ OS</h1>
              <p class="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Control Plane</p>
            </div>
          </div>

          <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <div class="px-3 mb-2 mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Governança SaaS</div>
            
            <a routerLink="/hq/dashboard" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">dashboard</mat-icon>
              Dashboard BI
            </a>
            
            <a routerLink="/hq/tenants" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">business</mat-icon>
              Gestão de Tenants
            </a>

            <a routerLink="/hq/billing" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">receipt_long</mat-icon>
              Billing & Ledger
            </a>

            <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ecossistema & Apps</div>

            <a routerLink="/hq/catalog" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">apps</mat-icon>
              Catálogo de Módulos
            </a>

            <a routerLink="/hq/dev-hub" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">api</mat-icon>
              Developer Hub & OTA
            </a>
            
            <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Infra & Diagnósticos</div>

            <a routerLink="/hq/telemetry" routerLinkActive="bg-indigo-500/10 text-indigo-300 border-indigo-500/30" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-slate-800/50 text-slate-400 transition-colors text-sm font-medium">
              <mat-icon class="text-lg">monitor_heart</mat-icon>
              Telemetria & Logs
            </a>

            <div class="px-3 mb-2 mt-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Planos do Ecossistema</div>
            
            <a routerLink="/os" class="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/80 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-xs font-medium">
              <span class="flex items-center gap-2">
                <mat-icon class="text-sm text-cyan-400">desktop_windows</mat-icon>
                Client OS (Runtime)
              </span>
              <mat-icon class="text-xs text-slate-500">open_in_new</mat-icon>
            </a>

            <a routerLink="/marketplace" class="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/80 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-xs font-medium mt-1">
              <span class="flex items-center gap-2">
                <mat-icon class="text-sm text-amber-400">storefront</mat-icon>
                Marketplace Público
              </span>
              <mat-icon class="text-xs text-slate-500">open_in_new</mat-icon>
            </a>
          </nav>

          <div class="p-4 border-t border-slate-800">
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800">
              <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <mat-icon class="text-slate-400 text-sm">person</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-white truncate">Superadmin HQ</div>
                <div class="text-[10px] text-emerald-400 font-mono">Controle Ativo</div>
              </div>
              <button (click)="logout()" class="text-slate-500 hover:text-white transition-colors" title="Encerrar Sessão">
                <mat-icon class="text-sm">logout</mat-icon>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Workspace (Desktop with Virtual Display Engine) -->
        <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <!-- Header / Taskbar equivalent -->
          <header class="h-14 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
            <div class="flex items-center gap-3 text-slate-400 text-sm">
              <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs">
                <mat-icon class="text-xs text-indigo-400">terminal</mat-icon>
                <span>3EATCRU HQ OS</span>
              </div>
              <span class="text-slate-600">|</span>
              <span class="text-xs text-slate-400 font-mono hidden sm:inline">Control Plane & SaaS Governance</span>
            </div>
            
            <div class="flex items-center gap-3">
              <!-- Global Command Palette Search Bar Trigger -->
              <button (click)="isCommandPaletteOpen.set(true)" 
                      class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-white transition-all text-xs font-medium">
                <mat-icon class="text-sm text-indigo-400">search</mat-icon>
                <span class="hidden md:inline">Buscar ou executar comando...</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-400">Alt + K</span>
              </button>

              <!-- Virtual Display Resolution & Scaling Trigger Badge -->
              <button (click)="isDisplaySettingsOpen.set(true)" 
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all text-xs font-mono shrink-0 cursor-pointer"
                      title="Configurar Resolução do Workspace e Escala Visual">
                <mat-icon class="text-xs text-indigo-400">aspect_ratio</mat-icon>
                <span class="hidden sm:inline">{{ displayEngine.displayBadgeLabel() }}</span>
                <span class="sm:hidden font-bold">{{ displayEngine.scaleFactor() }}%</span>
              </button>

              <!-- Support Mode Indicator Badge -->
              @if (identityService.isSupportImpersonating()) {
                <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                  <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span class="font-mono">Suporte: {{ identityService.impersonatedCompany()?.name }}</span>
                  <button (click)="identityService.exitSupportImpersonation()" class="hover:text-white text-xs underline font-bold ml-1">
                    Sair
                  </button>
                </div>
              }

              <!-- Live Clock -->
              <div class="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <mat-icon class="text-xs text-slate-500">schedule</mat-icon>
                <span>{{ currentTime() | date:'HH:mm:ss' }}</span>
              </div>

              <!-- Global Status -->
              <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Central Online
              </div>

              <!-- Activity Drawer Toggle -->
              <button (click)="toggleLogs()" class="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors" title="Logs da Central">
                <mat-icon class="text-sm">notifications</mat-icon>
                @if (hqState.logs().length > 0) {
                  <span class="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                    {{ hqState.logs().length > 9 ? '9+' : hqState.logs().length }}
                  </span>
                }
              </button>
            </div>
          </header>

          <!-- Router Outlet for HQ Apps inside Virtual Display Stage Canvas -->
          @if (displayEngine.selectedPresetId() === 'auto') {
            <div class="flex-1 overflow-auto p-6 relative" [style.transform]="'scale(' + displayEngine.effectiveScale() + ')'" [style.transformOrigin]="'top left'">
              <div class="max-w-6xl mx-auto">
                <router-outlet></router-outlet>
              </div>
            </div>
          } @else {
            <div class="flex-1 overflow-auto bg-slate-950 p-4 flex items-start justify-center relative">
              <div class="bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl overflow-auto relative p-6 transition-all duration-200"
                   [style.width.px]="displayEngine.targetWidth()"
                   [style.minHeight.px]="displayEngine.targetHeight()"
                   [style.transform]="'scale(' + displayEngine.effectiveScale() + ')'"
                   [style.transformOrigin]="'top center'">
                
                <!-- Virtual Resolution Header Bar indicator -->
                <div class="mb-4 pb-2 border-b border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500">
                  <span class="flex items-center gap-1.5">
                    <mat-icon class="text-xs text-indigo-400">monitor</mat-icon>
                    HQ Virtual Desktop Canvas: {{ displayEngine.targetWidth() }} × {{ displayEngine.targetHeight() }} px
                  </span>
                  <span>Escala: {{ displayEngine.scaleFactor() }}%</span>
                </div>

                <div class="max-w-6xl mx-auto">
                  <router-outlet></router-outlet>
                </div>
              </div>
            </div>
          }

          <!-- Command Palette Modal (Alt + K) -->
          @if (isCommandPaletteOpen()) {
            <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
              <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
                <div class="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
                  <mat-icon class="text-indigo-400">search</mat-icon>
                  <input #commandInput type="text" [value]="commandQuery()" (input)="onCommandQueryInput($event)"
                         placeholder="Digite um comando, aplicativo ou nome de tenant..."
                         class="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500">
                  <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">ESC</span>
                </div>

                <div class="p-3 max-h-80 overflow-y-auto space-y-2">
                  <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Navegação do Control Plane</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <button (click)="navigateAndClose('/hq/dashboard')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">dashboard</mat-icon>
                      <span>Dashboard BI</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/tenants')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">business</mat-icon>
                      <span>Gestão de Tenants</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/billing')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">receipt_long</mat-icon>
                      <span>Billing & Ledger</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/catalog')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">apps</mat-icon>
                      <span>Catálogo de Módulos</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/dev-hub')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">api</mat-icon>
                      <span>Developer Hub & OTA</span>
                    </button>
                    <button (click)="navigateAndClose('/hq/telemetry')" class="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                      <mat-icon class="text-sm text-indigo-400">monitor_heart</mat-icon>
                      <span>Telemetria & Logs</span>
                    </button>
                  </div>

                  <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-2 border-t border-slate-800/80">Atalhos Globais</div>
                  <button (click)="navigateAndClose('/os')" class="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-left text-xs text-slate-300 transition-colors">
                    <span class="flex items-center gap-2">
                      <mat-icon class="text-sm text-cyan-400">desktop_windows</mat-icon>
                      Acessar Client OS Workspace
                    </span>
                    <mat-icon class="text-xs text-slate-500">chevron_right</mat-icon>
                  </button>
                </div>

                <div class="p-2 border-t border-slate-800 bg-slate-950/50 flex justify-between text-[11px] text-slate-500">
                  <span>Pressione <strong class="text-slate-400">ESC</strong> para fechar</span>
                  <span>3EATCRU HQ OS</span>
                </div>
              </div>
            </div>
          }

          <!-- Virtual Display Settings Modal -->
          @if (isDisplaySettingsOpen()) {
            <app-hq-display-settings-modal (closeModal)="isDisplaySettingsOpen.set(false)" />
          }

          <!-- Activity / Logs Slide-over Panel -->
          @if (isLogsOpen()) {
            <div class="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
              <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-indigo-400 text-sm">history</mat-icon>
                  <span class="text-xs font-bold text-white uppercase tracking-wider">Log de Auditoria</span>
                </div>
                <button (click)="isLogsOpen.set(false)" class="text-slate-500 hover:text-white transition-colors">
                  <mat-icon class="text-sm">close</mat-icon>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                @for (log of hqState.logs(); track log.time) {
                  <div class="p-2.5 rounded border border-slate-800 bg-slate-950/40 text-[11px] leading-relaxed">
                    <div class="flex justify-between text-[9px] text-slate-500 mb-1">
                      <span class="uppercase font-bold" [ngClass]="{
                        'text-emerald-400': log.type === 'success',
                        'text-indigo-400': log.type === 'info',
                        'text-amber-400': log.type === 'warn'
                      }">{{ log.type }}</span>
                      <span>{{ log.time | date:'HH:mm:ss' }}</span>
                    </div>
                    <div class="text-slate-300">{{ log.text }}</div>
                  </div>
                }
                @if (hqState.logs().length === 0) {
                  <div class="text-center py-12 text-slate-500">Nenhum log gravado nesta sessão.</div>
                }
              </div>

              <div class="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-between">
                <button (click)="hqState.logs.set([])" class="text-xs text-rose-400 hover:text-rose-300 font-medium">Limpar Logs</button>
                <button (click)="isLogsOpen.set(false)" class="text-xs text-slate-400 hover:text-white font-medium">Fechar</button>
              </div>
            </div>
          }
        </main>
      </div>
    }
  `
})
export class HqOsShellComponent implements OnInit, OnDestroy {
  hqState = inject(HqStateService);
  identityService = inject(IdentityService);
  displayEngine = inject(OsDisplayEngineService);
  router = inject(Router);
  
  adminEmail = signal('');
  adminPassword = signal('');
  isLogsOpen = signal(false);
  isCommandPaletteOpen = signal(false);
  isDisplaySettingsOpen = signal(false);
  commandQuery = signal('');
  currentTime = signal(new Date());
  private clockInterval?: ReturnType<typeof setInterval>;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.altKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.isCommandPaletteOpen.update(v => !v);
    }
    if (event.key === 'Escape') {
      if (this.isCommandPaletteOpen()) this.isCommandPaletteOpen.set(false);
      if (this.isDisplaySettingsOpen()) this.isDisplaySettingsOpen.set(false);
    }
  }

  ngOnInit() {
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  onEmailInput(event: Event) {
    this.adminEmail.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event) {
    this.adminPassword.set((event.target as HTMLInputElement).value);
  }

  onCommandQueryInput(event: Event) {
    this.commandQuery.set((event.target as HTMLInputElement).value);
  }

  navigateAndClose(route: string) {
    this.router.navigateByUrl(route);
    this.isCommandPaletteOpen.set(false);
  }

  toggleLogs() {
    this.isLogsOpen.update(v => !v);
  }

  async onLoginSubmit(event: Event) {
    event.preventDefault();
    await this.hqState.login(this.adminEmail(), this.adminPassword());
  }

  logout() {
    this.hqState.logout();
  }
}

