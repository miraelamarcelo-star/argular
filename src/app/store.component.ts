import { Component, inject, signal, computed } from '@angular/core';
import { OsStateService } from './os-state.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from './core/application/window-manager.service';
import { AppCatalogItem, StoreAppResponse } from './core/domain/store/app-catalog.entity';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  template: `
    <div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6" id="os-store-root">
      
      <!-- Top Banner Frame -->
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-white flex flex-col md:flex-row md:items-center justify-between gap-6" id="os-store-header">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <mat-icon class="text-xs">verified_user</mat-icon>
            Central App Marketplace & Licenciamento
          </div>
          <h2 class="text-xl font-extrabold tracking-tight">3EATCRU Client OS Store</h2>
          <p class="text-xs text-slate-400 max-w-xl">
            Gerencie o ciclo de vida dos módulos autorizados e instalados no seu terminal comercial.
          </p>
        </div>

        <!-- System Stats & Wallet Panel -->
        <div class="flex flex-wrap items-center gap-4 shrink-0" id="os-store-stats-panel">
          <div class="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <mat-icon class="text-sm">terminal</mat-icon>
            </div>
            <div>
              <span class="block text-[9px] uppercase font-bold text-slate-400 leading-none">Canal / Versão</span>
              <strong class="text-xs text-slate-200 font-mono">v{{ state.company().osTargetVersion || '1.1.0' }} ({{ (state.company().channel || 'stable') | uppercase }})</strong>
            </div>
          </div>

          <div class="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <mat-icon class="text-sm">account_balance_wallet</mat-icon>
            </div>
            <div>
              <span class="block text-[9px] uppercase font-bold text-slate-400 leading-none">Carteira HQ</span>
              <strong class="text-xs text-emerald-400 font-mono">R$ {{ state.company().balance | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation & Action Bar -->
      <div class="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-200/80 pb-4" id="os-store-nav-bar">
        <!-- Store State Tabs -->
        <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start overflow-x-auto max-w-full" id="os-store-tabs">
          <button 
            (click)="activeTab.set('available')"
            [class.bg-white]="activeTab() === 'available'"
            [class.text-slate-900]="activeTab() === 'available'"
            [class.shadow-sm]="activeTab() === 'available'"
            [class.text-slate-600]="activeTab() !== 'available'"
            class="px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap">
            <mat-icon class="text-sm">grid_view</mat-icon>
            Disponíveis
            <span class="bg-slate-200 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded-full" [class.bg-indigo-100]="activeTab() === 'available'" [class.text-indigo-700]="activeTab() === 'available'">
              {{ availableAppsCount() }}
            </span>
          </button>

          <button 
            (click)="activeTab.set('installed')"
            [class.bg-white]="activeTab() === 'installed'"
            [class.text-slate-900]="activeTab() === 'installed'"
            [class.shadow-sm]="activeTab() === 'installed'"
            [class.text-slate-600]="activeTab() !== 'installed'"
            class="px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap">
            <mat-icon class="text-sm">check_circle</mat-icon>
            Instalados
            <span class="bg-slate-200 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded-full" [class.bg-indigo-100]="activeTab() === 'installed'" [class.text-indigo-700]="activeTab() === 'installed'">
              {{ installedAppsCount() }}
            </span>
          </button>

          <button 
            (click)="activeTab.set('updates')"
            [class.bg-white]="activeTab() === 'updates'"
            [class.text-slate-900]="activeTab() === 'updates'"
            [class.shadow-sm]="activeTab() === 'updates'"
            [class.text-slate-600]="activeTab() !== 'updates'"
            class="px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap">
            <mat-icon class="text-sm" [class.animate-bounce]="hasPendingUpdates()">system_update_alt</mat-icon>
            Atualizações
            @if (hasPendingUpdates()) {
              <span class="bg-amber-100 text-amber-800 border border-amber-200 font-mono text-[10px] px-1.5 py-0.5 rounded-full">
                {{ pendingUpdatesCount() }}
              </span>
            } @else {
              <span class="bg-slate-200 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded-full">0</span>
            }
          </button>

          <button 
            (click)="activeTab.set('incompatible')"
            [class.bg-white]="activeTab() === 'incompatible'"
            [class.text-slate-900]="activeTab() === 'incompatible'"
            [class.shadow-sm]="activeTab() === 'incompatible'"
            [class.text-slate-600]="activeTab() !== 'incompatible'"
            class="px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap">
            <mat-icon class="text-sm">report_problem</mat-icon>
            Incompatíveis
            <span class="bg-slate-200 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded-full">
              {{ incompatibleAppsCount() }}
            </span>
          </button>
        </div>

        <!-- Search input inside action bar -->
        <div class="relative w-full md:w-80" id="os-store-search">
          <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Filtrar aplicativos nesta seção..." 
            class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm">
        </div>
      </div>

      <!-- Main Display Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="os-store-grid">
        
        <!-- Tab 1: Available Módulos -->
        @if (activeTab() === 'available') {
          @for (item of filteredAvailable(); track item.app.id) {
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
              <div class="p-6 space-y-4">
                <!-- Icon and Title -->
                <div class="flex items-start justify-between gap-3">
                  <div class="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <mat-icon class="text-2xl">{{ item.app.icon }}</mat-icon>
                  </div>
                  <div class="flex-1">
                    <h3 class="font-bold text-slate-900 text-sm line-clamp-1">{{ item.app.name }}</h3>
                    <span class="inline-block text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                      {{ item.app.category }}
                    </span>
                  </div>
                  <span class="shrink-0 text-xs font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                    @if (item.app.pricing.model === 'FREE') { Grátis } 
                    @else { R$ {{ item.app.pricing.amount | number:'1.2-2' }}/mês }
                  </span>
                </div>

                <p class="text-slate-600 text-xs leading-relaxed min-h-[48px] line-clamp-3">{{ item.app.description }}</p>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span class="flex items-center gap-1">
                    <mat-icon class="text-xs text-emerald-500">verified</mat-icon>
                    Core Signed
                  </span>
                  <span>v{{ item.app.currentRelease?.version || '1.0.0' }}</span>
                </div>
              </div>

              <!-- CTA Container -->
              <div class="px-6 pb-6 pt-2">
                <button 
                  (click)="installApp(item.app)"
                  [disabled]="installingAppId() === item.app.id || (item.app.pricing.model !== 'FREE' && state.company().balance < item.app.pricing.amount)"
                  class="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm">
                  @if (installingAppId() === item.app.id) {
                    <mat-icon class="text-sm animate-spin">sync</mat-icon>
                    Autorizando Licença...
                  } @else if (item.app.pricing.model !== 'FREE' && state.company().balance < item.app.pricing.amount) {
                    <mat-icon class="text-sm">block</mat-icon>
                    Saldo Insuficiente
                  } @else {
                    <mat-icon class="text-sm">download</mat-icon>
                    Adquirir & Instalar
                  }
                </button>
              </div>
            </div>
          }
        }

        <!-- Tab 2: Installed Apps -->
        @if (activeTab() === 'installed') {
          @for (item of filteredInstalled(); track item.app.id) {
            <div class="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden flex flex-col justify-between">
              
              <!-- Card Body -->
              <div class="p-6 space-y-4">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <mat-icon class="text-2xl">{{ item.app.icon }}</mat-icon>
                    </div>
                    <div>
                      <h3 class="font-bold text-slate-900 text-sm">{{ item.app.name }}</h3>
                      <div class="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Licença Ativa
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex flex-col items-end gap-1">
                    <span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold border border-emerald-200">
                      Instalado (v{{ item.installedVersion || '1.0.0' }})
                    </span>
                    @if (item.status === 'UPDATE_AVAILABLE') {
                      <span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-sans font-bold uppercase animate-pulse">
                        Update Disponível
                      </span>
                    }
                  </div>
                </div>

                <p class="text-slate-600 text-xs leading-relaxed min-h-[48px] line-clamp-3">{{ item.app.description }}</p>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Desenvolvedor: {{ item.app.developer }}</span>
                  <span>OS Alvo: >= v{{ item.app.currentRelease?.minOsVersion || '1.1.0' }}</span>
                </div>
              </div>

              <!-- Actions row -->
              <div class="px-6 pb-6 pt-2 grid grid-cols-2 gap-3">
                <button 
                  (click)="openApp(item.app)"
                  class="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-sm">
                  <mat-icon class="text-sm">open_in_new</mat-icon>
                  Abrir App
                </button>

                <button 
                  (click)="uninstallApp(item.app)"
                  [disabled]="uninstallingAppId() === item.app.id"
                  class="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-3 py-2 rounded-xl font-bold text-xs transition-all">
                  @if (uninstallingAppId() === item.app.id) {
                    <mat-icon class="text-sm animate-spin">sync</mat-icon>
                  } @else {
                    <mat-icon class="text-sm">delete_outline</mat-icon>
                  }
                  Desinstalar
                </button>
              </div>
            </div>
          }
        }

        <!-- Tab 3: Updates Section -->
        @if (activeTab() === 'updates') {
          @for (item of filteredUpdates(); track item.app.id) {
            <div class="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden flex flex-col justify-between p-6 space-y-4">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <mat-icon class="text-2xl">{{ item.app.icon }}</mat-icon>
                  </div>
                  <div>
                    <h3 class="font-bold text-slate-900 text-sm">{{ item.app.name }}</h3>
                    <span class="inline-block text-[10px] text-amber-700 font-bold bg-amber-50 px-2 rounded font-mono border border-amber-200">
                      Atualização Disponível
                    </span>
                  </div>
                </div>
              </div>

              <!-- Progress indicator if updating -->
              @if (updatingAppId() === item.app.id) {
                <div class="space-y-1.5">
                  <div class="flex justify-between text-[11px] font-mono">
                    <span class="text-amber-700 font-bold">Instalando novos binários...</span>
                    <span>{{ updateProgress() }}%</span>
                  </div>
                  <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div class="bg-amber-500 h-full transition-all duration-150" [style.width.%]="updateProgress()"></div>
                  </div>
                </div>
              } @else {
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                  <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span class="block text-[10px] text-slate-400">Versão Instalada:</span>
                      <strong class="text-slate-600">v{{ item.installedVersion || '1.0.0' }}</strong>
                    </div>
                    <div>
                      <span class="block text-[10px] text-amber-600">Nova Versão:</span>
                      <strong class="text-amber-700">v{{ item.app.currentRelease?.version || '1.3.0' }}</strong>
                    </div>
                  </div>
                  <p class="text-[10px] text-slate-500 italic leading-relaxed">
                    Melhorias de segurança e conformidade de transações com o faturamento do Central HQ.
                  </p>
                </div>
              }

              <button 
                (click)="triggerUpdate(item.app)"
                [disabled]="updatingAppId() !== null"
                class="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white disabled:bg-slate-100 disabled:text-slate-400 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm">
                <mat-icon class="text-sm">system_update_alt</mat-icon>
                {{ updatingAppId() === item.app.id ? 'Atualizando OS...' : 'Instalar Atualização' }}
              </button>
            </div>
          }
        }

        <!-- Tab 4: Incompatible Apps -->
        @if (activeTab() === 'incompatible') {
          @for (item of filteredIncompatible(); track item.app.id) {
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 opacity-75 overflow-hidden flex flex-col justify-between">
              
              <div class="p-6 space-y-4 bg-slate-50/50">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <mat-icon class="text-2xl">{{ item.app.icon }}</mat-icon>
                    </div>
                    <div>
                      <h3 class="font-bold text-slate-700 text-sm">{{ item.app.name }}</h3>
                      <span class="inline-block text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-mono">
                        Bloqueado por Incompatibilidade
                      </span>
                    </div>
                  </div>
                </div>

                <div class="p-3 bg-red-50/50 rounded-xl border border-red-100 text-[11px] text-red-800 space-y-1.5">
                  <div class="font-bold flex items-center gap-1.5">
                    <mat-icon class="text-sm">warning_amber</mat-icon>
                    Requisito de Kernel
                  </div>
                  <div class="font-mono text-[10px] leading-relaxed">
                    Requer 3EATCRU OS >= v{{ item.app.currentRelease?.minOsVersion || '1.2.0' }}<br>
                    Seu OS atual: v{{ state.company().osTargetVersion || '1.1.0' }}
                  </div>
                </div>
              </div>

              <div class="px-6 pb-6 pt-2 bg-slate-50/50">
                <button 
                  (click)="showIncompatibilityNotice(item.app)"
                  class="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm">
                  <mat-icon class="text-sm">info_outline</mat-icon>
                  Ver Detalhes do Erro
                </button>
              </div>
            </div>
          }
        }

        <!-- Empty State Handling -->
        @if (getTabItemCount() === 0) {
          <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-3" id="os-store-empty">
            <div class="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
              <mat-icon class="text-3xl">folder_open</mat-icon>
            </div>
            <h4 class="text-sm font-bold text-slate-700">Nenhum módulo nesta seção</h4>
            <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Não há aplicativos correspondentes ao seu filtro atual nesta seção do mercado de módulos.
            </p>
          </div>
        }
      </div>

      <!-- Sleek Custom Toast Notification -->
      @if (toastMessage()) {
        <div class="fixed bottom-6 right-6 z-50 bg-slate-900 border border-white/10 text-white text-xs px-4 py-3 rounded-xl shadow-lg flex items-center gap-2" id="store-custom-toast">
          <mat-icon class="text-emerald-400 text-sm">check_circle</mat-icon>
          <span>{{ toastMessage() }}</span>
          <button (click)="toastMessage.set(null)" class="ml-2 hover:text-slate-300">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- Gorgeous Compatibility Modal -->
      @if (incompatibilityModalApp(); as app) {
        <div class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" id="compat-modal-overlay">
          <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4" id="compat-modal-content">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <mat-icon>report_problem</mat-icon>
              </div>
              <div class="space-y-1">
                <h3 class="font-bold text-slate-900 text-sm">Requisito de Sistema Não Atendido</h3>
                <p class="text-xs text-slate-500">Módulo: <strong>{{ app.name }}</strong></p>
              </div>
            </div>

            <div class="p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-mono text-[11px] leading-relaxed text-slate-600 space-y-1">
              <div>Requer Kernel: <strong class="text-indigo-600">3eatcru OS >= v{{ app.currentRelease?.minOsVersion }}</strong></div>
              <div>Versão Atual: <strong class="text-slate-800">v{{ state.company().osTargetVersion }}</strong></div>
              <div class="text-[10px] text-red-500 font-bold mt-2">Status: INSTALAÇÃO BLOQUEADA PELO KERNEL</div>
            </div>

            <p class="text-xs text-slate-500 leading-relaxed">
              Para liberar este módulo, acesse o painel administrativo das configurações do OS e solicite a atualização de release do seu terminal comercial para a versão requerida.
            </p>

            <div class="flex justify-end">
              <button 
                (click)="incompatibilityModalApp.set(null)" 
                class="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm">
                Entendido
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Uninstall Confirmation Modal -->
      @if (confirmUninstallApp(); as app) {
        <div class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" id="uninstall-modal-overlay">
          <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4" id="uninstall-modal-content">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <mat-icon>delete_outline</mat-icon>
              </div>
              <div class="space-y-1">
                <h3 class="font-bold text-slate-900 text-sm">Confirmar Desinstalação</h3>
                <p class="text-xs text-slate-500">Módulo: <strong>{{ app.name }}</strong></p>
              </div>
            </div>

            <p class="text-xs text-slate-500 leading-relaxed">
              Tem certeza de que deseja remover este módulo do seu terminal? 
              A licença comercial continuará ativa em sua conta, permitindo reinstalá-lo a qualquer momento sem nova cobrança.
            </p>

            <div class="flex justify-end gap-2.5 pt-2">
              <button 
                (click)="confirmUninstallApp.set(null)" 
                class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all">
                Cancelar
              </button>
              <button 
                (click)="executeUninstall(app)" 
                class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm">
                Desinstalar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class StoreComponent {
  state = inject(OsStateService);
  private windowManager = inject(WindowManagerService);

  searchQuery = signal('');
  activeTab = signal<'available' | 'installed' | 'updates' | 'incompatible'>('available');
  
  installingAppId = signal<string | null>(null);
  uninstallingAppId = signal<string | null>(null);
  updatingAppId = signal<string | null>(null);
  updateProgress = signal<number>(0);

  // Sleek custom UI signals
  toastMessage = signal<string | null>(null);
  incompatibilityModalApp = signal<AppCatalogItem | null>(null);
  confirmUninstallApp = signal<AppCatalogItem | null>(null);

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  // Filter items using server-authoritative response mapping
  private filterByQuery(items: StoreAppResponse[]): StoreAppResponse[] {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return items;
    return items.filter(item => 
      item.app.name.toLowerCase().includes(q) || 
      item.app.description.toLowerCase().includes(q) || 
      item.app.developer.toLowerCase().includes(q)
    );
  }

  readonly filteredAvailable = computed(() => {
    const items = this.state.storeAppsWithStatus();
    const matched = items.filter(item => item.status === 'AVAILABLE');
    return this.filterByQuery(matched);
  });

  readonly filteredInstalled = computed(() => {
    const items = this.state.storeAppsWithStatus();
    const matched = items.filter(item => item.status === 'INSTALLED' || item.status === 'UPDATE_AVAILABLE');
    return this.filterByQuery(matched);
  });

  readonly filteredIncompatible = computed(() => {
    const items = this.state.storeAppsWithStatus();
    const matched = items.filter(item => item.status === 'INCOMPATIBLE');
    return this.filterByQuery(matched);
  });

  readonly filteredUpdates = computed(() => {
    const items = this.state.storeAppsWithStatus();
    const matched = items.filter(item => item.status === 'UPDATE_AVAILABLE');
    return this.filterByQuery(matched);
  });

  // Count signals for tab badges
  readonly availableAppsCount = computed(() => this.filteredAvailable().length);
  readonly installedAppsCount = computed(() => this.filteredInstalled().length);
  readonly incompatibleAppsCount = computed(() => this.filteredIncompatible().length);
  readonly pendingUpdatesCount = computed(() => this.filteredUpdates().length);
  readonly hasPendingUpdates = computed(() => this.pendingUpdatesCount() > 0);

  getTabItemCount(): number {
    switch (this.activeTab()) {
      case 'available': return this.filteredAvailable().length;
      case 'installed': return this.filteredInstalled().length;
      case 'updates': return this.filteredUpdates().length;
      case 'incompatible': return this.filteredIncompatible().length;
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }

  // Acquisition Action
  async installApp(app: AppCatalogItem) {
    if (app.pricing.model !== 'FREE' && this.state.company().balance < app.pricing.amount) {
      return;
    }
    this.installingAppId.set(app.id);
    try {
      const success = await this.state.installApp(app.id);
      if (success) {
        this.showToast(`Módulo ${app.name} adquirido e instalado com sucesso!`);
      } else {
        this.showToast(`Falha na instalação de ${app.name}. Verifique saldo ou requisitos.`);
      }
    } catch (err) {
      console.error(err);
      this.showToast(`Erro ao conectar com o servidor da loja.`);
    } finally {
      this.installingAppId.set(null);
    }
  }

  // Safe Modal triggers instead of browser alert/confirm
  uninstallApp(app: AppCatalogItem) {
    this.confirmUninstallApp.set(app);
  }

  async executeUninstall(app: AppCatalogItem) {
    this.confirmUninstallApp.set(null);
    this.uninstallingAppId.set(app.id);
    try {
      await this.state.uninstallApp(app.id);
      this.showToast(`Módulo ${app.name} desinstalado com sucesso.`);
    } catch (err) {
      console.error(err);
      this.showToast(`Erro ao desinstalar o módulo.`);
    } finally {
      this.uninstallingAppId.set(null);
    }
  }

  openApp(app: AppCatalogItem) {
    this.windowManager.openWindow(app.id, app.name, app.icon);
  }

  // Genuine Smooth-Animate Server Update Trigger
  async triggerUpdate(app: AppCatalogItem) {
    if (this.updatingAppId() !== null) return;
    this.updatingAppId.set(app.id);
    this.updateProgress.set(0);

    // Trigger real backend database update call in parallel
    const apiCall = this.state.updateApp(app.id);

    // Smooth progress animation to give beautiful sensory feedback while downloading new artifacts
    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.floor((elapsed / duration) * 100), 99);
      if (pct < 99 && this.updatingAppId() === app.id) {
        this.updateProgress.set(pct);
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    try {
      const success = await apiCall;
      if (success) {
        this.updateProgress.set(100);
        this.showToast(`Módulo ${app.name} atualizado com sucesso para a versão estável mais recente!`);
      } else {
        this.showToast(`Não foi possível atualizar ${app.name}. Requisitos do OS não atingidos.`);
      }
    } catch (err) {
      console.error(err);
      this.showToast(`Erro ao processar atualização no servidor.`);
    } finally {
      // Delay cleaning progress so user sees the 100% completion state
      setTimeout(() => {
        this.updatingAppId.set(null);
      }, 400);
    }
  }

  showIncompatibilityNotice(app: AppCatalogItem) {
    this.incompatibilityModalApp.set(app);
  }
}
