import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface StartMenuAppItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  isSystem: boolean;
}

@Component({
  selector: 'app-os-start-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div 
        id="windows10-start-menu"
        class="absolute bottom-13 left-0 sm:left-2 w-full sm:w-[700px] md:w-[780px] lg:w-[840px] h-[580px] max-h-[calc(100vh-3.8rem)] z-50 bg-[#1e1e1e]/95 sm:bg-[#181818]/95 backdrop-blur-2xl border border-white/10 sm:rounded-xl shadow-2xl text-white flex flex-col sm:flex-row overflow-hidden animate-start-slide select-none">
        
        <!-- Mobile View Tab Switcher -->
        <div class="flex sm:hidden border-b border-white/10 bg-white/5 shrink-0">
          <button 
            (click)="startMenuTab.set('all')"
            [class.text-sky-400]="startMenuTab() === 'all'"
            [class.border-b-2]="startMenuTab() === 'all'"
            [class.border-sky-400]="startMenuTab() === 'all'"
            class="flex-1 py-2 text-xs font-semibold text-center text-slate-300 transition-colors">
            Todas as Aplicações
          </button>
          <button 
            (click)="startMenuTab.set('tiles')"
            [class.text-sky-400]="startMenuTab() === 'tiles'"
            [class.border-b-2]="startMenuTab() === 'tiles'"
            [class.border-sky-400]="startMenuTab() === 'tiles'"
            class="flex-1 py-2 text-xs font-semibold text-center text-slate-300 transition-colors">
            Blocos Dinâmicos
          </button>
        </div>

        <!-- Left Rail (Windows 10 Navigation Bar) -->
        <div 
          class="relative flex flex-col justify-between py-2 border-r border-white/5 shrink-0 transition-all duration-200 bg-[#141414]"
          [class.w-12]="!isStartNavExpanded()"
          [class.w-52]="isStartNavExpanded()">
          
          <!-- Top: Hamburger Menu -->
          <div class="flex flex-col">
            <button 
              (click)="toggleStartNav()"
              title="Expandir Iniciar"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <mat-icon class="text-lg">menu</mat-icon>
              @if (isStartNavExpanded()) {
                <span class="text-xs font-bold tracking-wider uppercase text-slate-200 truncate">INICIAR</span>
              }
            </button>
          </div>

          <!-- Bottom: User, Folders & Power Controls -->
          <div class="flex flex-col relative">
            
            <!-- Power Flyout Popup -->
            @if (isPowerMenuOpen()) {
              <div class="absolute bottom-2 left-12 w-48 bg-[#252525] border border-white/10 shadow-2xl rounded-lg p-1.5 z-50 space-y-0.5 animate-tray-slide">
                <button 
                  (click)="lockSystem.emit(); isPowerMenuOpen.set(false); closeMenu.emit()" 
                  class="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-md transition-colors text-left">
                  <mat-icon class="text-sm text-slate-300">lock</mat-icon>
                  <span>Bloquear Terminal</span>
                </button>
                <button 
                  (click)="refreshDesktop.emit(); isPowerMenuOpen.set(false); closeMenu.emit()" 
                  class="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-md transition-colors text-left">
                  <mat-icon class="text-sm text-slate-300">restart_alt</mat-icon>
                  <span>Reiniciar Ambiente</span>
                </button>
                <button 
                  (click)="logoutSession.emit(); isPowerMenuOpen.set(false); closeMenu.emit()" 
                  class="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20 rounded-md transition-colors text-left">
                  <mat-icon class="text-sm text-rose-400">logout</mat-icon>
                  <span>Encerrar Sessão</span>
                </button>
              </div>
            }

            <!-- User Flyout Popup -->
            @if (isUserMenuOpen()) {
              <div class="absolute bottom-32 left-12 w-60 bg-[#252525] border border-white/10 shadow-2xl rounded-lg p-3 z-50 space-y-2 animate-tray-slide">
                <div class="flex items-center gap-2.5 pb-2 border-b border-white/10">
                  <div class="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                    <mat-icon class="text-base">person</mat-icon>
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-white truncate">{{ activeOperator()?.name || 'Operador Local' }}</div>
                    <div class="text-[10px] text-slate-400 font-mono">{{ activeOperator()?.role || 'operador' }} · {{ companyName() }}</div>
                  </div>
                </div>
                <button 
                  (click)="lockSystem.emit(); isUserMenuOpen.set(false); closeMenu.emit()" 
                  class="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-md transition-colors text-left">
                  <mat-icon class="text-sm text-slate-300">lock</mat-icon>
                  <span>Bloquear Terminal</span>
                </button>
              </div>
            }

            <!-- User Button -->
            <button 
              (click)="toggleUserMenu()"
              [title]="activeOperator()?.name || 'Conta de Usuário'"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <div class="w-5 h-5 rounded-full bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-indigo-300 text-[10px] shrink-0">
                <mat-icon class="text-xs">person</mat-icon>
              </div>
              @if (isStartNavExpanded()) {
                <span class="text-xs text-slate-200 truncate">{{ activeOperator()?.name || 'Operador' }}</span>
              }
            </button>

            <!-- Documents Button -->
            <button 
              (click)="openFileExplorer.emit('documentos'); closeMenu.emit()"
              title="Documentos"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <mat-icon class="text-lg shrink-0 text-amber-400">folder</mat-icon>
              @if (isStartNavExpanded()) {
                <span class="text-xs text-slate-200 truncate">Documentos</span>
              }
            </button>

            <!-- Pictures Button -->
            <button 
              (click)="openFileExplorer.emit('imagens'); closeMenu.emit()"
              title="Imagens"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <mat-icon class="text-lg shrink-0 text-emerald-400">image</mat-icon>
              @if (isStartNavExpanded()) {
                <span class="text-xs text-slate-200 truncate">Imagens</span>
              }
            </button>

            <!-- Settings Button -->
            <button 
              (click)="openSettings.emit(); closeMenu.emit()"
              title="Configurações"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <mat-icon class="text-lg shrink-0">settings</mat-icon>
              @if (isStartNavExpanded()) {
                <span class="text-xs text-slate-200 truncate">Configurações</span>
              }
            </button>

            <!-- Power Button -->
            <button 
              (click)="togglePowerMenu()"
              title="Ligar / Desligar"
              class="w-full h-10 flex items-center px-3.5 gap-4 text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <mat-icon class="text-lg shrink-0">power_settings_new</mat-icon>
              @if (isStartNavExpanded()) {
                <span class="text-xs text-slate-200 truncate">Ligar / Desligar</span>
              }
            </button>
          </div>
        </div>

        <!-- Middle Column (Windows 10 Alphabetical Apps List) -->
        <div 
          class="w-full sm:w-[260px] md:w-[290px] flex flex-col border-r border-white/5 shrink-0 bg-[#1a1a1a]/90"
          [class.hidden]="startMenuTab() !== 'all'"
          [class.sm:flex]="true">
          
          <!-- Search bar inside Start Menu -->
          <div class="p-2.5 border-b border-white/5">
            <div class="relative">
              <mat-icon class="absolute left-2.5 top-2 text-slate-400 text-sm">search</mat-icon>
              <input 
                id="start-menu-search"
                type="text" 
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                placeholder="Digitar para pesquisar..." 
                class="w-full bg-white/5 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all font-sans">
            </div>
          </div>

          <!-- Scrollable Apps Directory -->
          <div class="flex-1 overflow-y-auto p-2 space-y-3">
            
            @if (searchQuery().trim()) {
              <!-- Grounded Web Search Option -->
              <button 
                (click)="searchWeb.emit(searchQuery()); searchQuery.set('')"
                class="w-full flex items-center gap-2.5 p-2 rounded-md bg-sky-600/10 border border-sky-500/20 text-left transition-all hover:bg-sky-600/20 group">
                <div class="w-7 h-7 rounded-sm bg-sky-600 flex items-center justify-center text-white shrink-0">
                  <mat-icon class="text-sm">menu_book</mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-sky-300">Buscar Documentos</div>
                  <div class="text-[10px] text-slate-400 truncate">"{{ searchQuery() }}" (Especificações Locais)</div>
                </div>
              </button>

              <!-- Search Results -->
              <div class="space-y-0.5">
                @for (app of filteredApps(); track app.id) {
                  <button 
                    (click)="launchApp.emit(app); closeMenu.emit()"
                    class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm hover:bg-white/10 text-left transition-colors group">
                    <div class="w-6 h-6 rounded-sm flex items-center justify-center text-white shrink-0" [ngClass]="app.color">
                      <mat-icon class="text-xs">{{ app.icon }}</mat-icon>
                    </div>
                    <span class="text-xs text-slate-200 group-hover:text-white truncate flex-1">{{ app.name }}</span>
                  </button>
                }
                @if (filteredApps().length === 0) {
                  <div class="text-xs text-slate-500 text-center py-6">Nenhum aplicativo encontrado.</div>
                }
              </div>
            } @else {
              <!-- 1. "Adicionados recentemente" -->
              <div class="space-y-1">
                <div class="text-[11px] font-semibold text-slate-400 px-2 py-0.5">Adicionados recentemente</div>
                @for (app of recentlyAddedApps(); track app.id) {
                  <button 
                    (click)="launchApp.emit(app); closeMenu.emit()"
                    class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm hover:bg-white/10 text-left transition-colors group">
                    <div class="w-6 h-6 rounded-sm flex items-center justify-center text-white shrink-0" [ngClass]="app.color">
                      <mat-icon class="text-xs">{{ app.icon }}</mat-icon>
                    </div>
                    <div class="flex-1 min-w-0 flex items-center justify-between">
                      <span class="text-xs text-slate-200 group-hover:text-white truncate">{{ app.name }}</span>
                      <span class="text-[9px] text-sky-400 font-medium px-1 bg-sky-500/10 rounded">Novo</span>
                    </div>
                  </button>
                }
              </div>

              <!-- 2. System Folders -->
              <div class="space-y-1 border-t border-white/5 pt-1">
                <!-- Folder: Acessórios do Sistema -->
                <div>
                  <button 
                    (click)="toggleFolder('accessories')"
                    class="w-full flex items-center justify-between px-2 py-1 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition-colors">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-sm text-slate-400">folder</mat-icon>
                      <span class="text-xs font-normal">Acessórios do Sistema</span>
                    </div>
                    <mat-icon class="text-xs text-slate-500">
                      {{ expandedFolders()['accessories'] ? 'expand_more' : 'chevron_right' }}
                    </mat-icon>
                  </button>
                  @if (expandedFolders()['accessories']) {
                    <div class="pl-6 pr-1 space-y-0.5 py-0.5 border-l border-white/10 ml-4 mt-0.5">
                      <button (click)="openFileExplorer.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-amber-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">folder_open</mat-icon></div>
                        <span>Explorador de Arquivos</span>
                      </button>
                      <button (click)="openCalculator.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-teal-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">calculate</mat-icon></div>
                        <span>Calculadora</span>
                      </button>
                      <button (click)="openBrowser.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-indigo-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">explore</mat-icon></div>
                        <span>Navegador Web OS</span>
                      </button>
                      <button (click)="openInstalledApps.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-emerald-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">apps</mat-icon></div>
                        <span>Meus Aplicativos</span>
                      </button>
                    </div>
                  }
                </div>

                <!-- Folder: Ferramentas do Kernel -->
                <div>
                  <button 
                    (click)="toggleFolder('kernel')"
                    class="w-full flex items-center justify-between px-2 py-1 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition-colors">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-sm text-slate-400">folder</mat-icon>
                      <span class="text-xs font-normal">Ferramentas do Kernel</span>
                    </div>
                    <mat-icon class="text-xs text-slate-500">
                      {{ expandedFolders()['kernel'] ? 'expand_more' : 'chevron_right' }}
                    </mat-icon>
                  </button>
                  @if (expandedFolders()['kernel']) {
                    <div class="pl-6 pr-1 space-y-0.5 py-0.5 border-l border-white/10 ml-4 mt-0.5">
                      <button (click)="openTaskManager.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-rose-700 flex items-center justify-center text-white"><mat-icon class="text-[11px]">view_timeline</mat-icon></div>
                        <span>Gerenciador de Tarefas</span>
                      </button>
                      <button (click)="openSettings.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-slate-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">settings</mat-icon></div>
                        <span>Painel de Controle</span>
                      </button>
                      <button (click)="openStore.emit(); closeMenu.emit()" class="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-sm text-left text-slate-300 hover:text-white text-xs">
                        <div class="w-5 h-5 rounded-sm bg-sky-600 flex items-center justify-center text-white"><mat-icon class="text-[11px]">storefront</mat-icon></div>
                        <span>App Store</span>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- 3. Alphabetical App List -->
              <div class="space-y-2 border-t border-white/5 pt-1">
                @for (group of alphabeticalAppsGrouped(); track group.letter) {
                  <div class="space-y-0.5">
                    <div class="text-[11px] font-bold text-sky-400 px-2 py-0.5">{{ group.letter }}</div>
                    @for (app of group.apps; track app.id) {
                      <button 
                        (click)="launchApp.emit(app); closeMenu.emit()"
                        class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm hover:bg-white/10 text-left transition-colors group">
                        <div class="w-6 h-6 rounded-sm flex items-center justify-center text-white shrink-0" [ngClass]="app.color">
                          <mat-icon class="text-xs">{{ app.icon }}</mat-icon>
                        </div>
                        <span class="text-xs text-slate-200 group-hover:text-white truncate flex-1 font-normal">{{ app.name }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }

          </div>
        </div>

        <!-- Right Section (Windows 10 Live Tiles Grid) -->
        <div 
          class="flex-1 p-3.5 overflow-y-auto bg-[#1b1b1b]"
          [class.hidden]="startMenuTab() !== 'tiles'"
          [class.sm:block]="true">
          
          <!-- Group 1: Produtividade -->
          <div class="mb-5">
            <div class="flex items-center justify-between mb-2 px-1">
              <h3 class="text-xs font-semibold text-slate-300">Produtividade</h3>
              <span class="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Workspace</span>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              
              <!-- PDV 365 (Wide Tile) -->
              <button 
                (click)="openAppById('app_pos')"
                class="col-span-2 h-26 bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-700 hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-1.5">
                    <mat-icon class="text-base text-white">point_of_sale</mat-icon>
                    <span class="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">3eatcru POS</span>
                  </div>
                  <span class="text-[9px] px-1.5 py-0.5 bg-black/25 text-white/90 rounded font-mono">365 Online</span>
                </div>
                <div>
                  <div class="text-sm font-bold text-white leading-tight">PDV & Vendas</div>
                  <div class="text-[10px] text-indigo-200/90 truncate">Frente de caixa e emissão fiscal</div>
                </div>
              </button>

              <!-- Navegador Web OS -->
              <button 
                (click)="openBrowser.emit(); closeMenu.emit()"
                class="col-span-1 h-26 bg-gradient-to-br from-sky-600 to-blue-700 hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm">
                <div class="flex justify-end">
                  <mat-icon class="text-base text-white/90">menu_book</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Docs OS</div>
                  <div class="text-[9px] text-sky-200 truncate">Especificações</div>
                </div>
              </button>

              <!-- CRM & Clientes -->
              <button 
                (click)="openAppById('app_crm')"
                class="col-span-1 h-24 bg-[#0077b5] hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-white">groups</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white truncate">CRM Fidelidade</div>
                  <div class="text-[9px] text-sky-100 truncate">Clientes & Leads</div>
                </div>
              </button>

              <!-- Tarefas & Telemetria OS -->
              <button 
                (click)="openTaskManager.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-rose-950/90 border border-rose-500/30 hover:bg-rose-900/90 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm">
                <div class="flex items-center justify-between">
                  <mat-icon class="text-base text-rose-300">view_timeline</mat-icon>
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Kernel Ativo"></span>
                </div>
                <div>
                  <div class="text-xs font-bold text-rose-200">Tarefas OS</div>
                  <div class="text-[9px] text-rose-300/80 truncate">Processos & CPU</div>
                </div>
              </button>

              <!-- Inventário & WMS -->
              <button 
                (click)="openAppById('app_inventory')"
                class="col-span-1 h-24 bg-amber-600 hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-white">inventory_2</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Inventário</div>
                  <div class="text-[9px] text-amber-100 truncate">Estoque & Grade</div>
                </div>
              </button>

            </div>
          </div>

          <!-- Group 2: Explorar -->
          <div>
            <div class="flex items-center justify-between mb-2 px-1">
              <h3 class="text-xs font-semibold text-slate-300">Explorar</h3>
              <span class="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Apps & Ferramentas</span>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              
              <!-- App Store -->
              <button 
                (click)="openStore.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-[#232323] hover:bg-[#2c2c2c] border border-white/5 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-sky-400">storefront</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">App Store</div>
                  <div class="text-[9px] text-slate-400 truncate">Catálogo & Módulos</div>
                </div>
              </button>

              <!-- Explorador de Arquivos -->
              <button 
                (click)="openFileExplorer.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-[#232323] hover:bg-[#2c2c2c] border border-white/5 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-amber-400">folder_open</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Arquivos</div>
                  <div class="text-[9px] text-slate-400 truncate">Este Computador</div>
                </div>
              </button>

              <!-- Calculadora -->
              <button 
                (click)="openCalculator.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-[#232323] hover:bg-[#2c2c2c] border border-white/5 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-teal-400">calculate</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Calculadora</div>
                  <div class="text-[9px] text-slate-400 truncate">Padrão & Comercial</div>
                </div>
              </button>

              <!-- Pedidos Balcão -->
              <button 
                (click)="openAppById('app_tables')"
                class="col-span-1 h-24 bg-blue-700 hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-white">checklist</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Pedidos</div>
                  <div class="text-[9px] text-blue-200 truncate">Mesas & Balcão</div>
                </div>
              </button>

              <!-- Finanças & Relatórios -->
              <button 
                (click)="openAppById('app_finance')"
                class="col-span-1 h-24 bg-emerald-700 hover:brightness-110 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-white">payments</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Finanças</div>
                  <div class="text-[9px] text-emerald-200 truncate">Fluxo & DRE</div>
                </div>
              </button>

              <!-- Configurações do OS -->
              <button 
                (click)="openSettings.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-[#232323] hover:bg-[#2c2c2c] border border-white/5 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-slate-300">settings</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Configurações</div>
                  <div class="text-[9px] text-slate-400 truncate">Sistema & Hardware</div>
                </div>
              </button>

              <!-- Grounded AI -->
              <button 
                (click)="openBrowser.emit(); closeMenu.emit()"
                class="col-span-1 h-24 bg-[#202123] border border-white/10 hover:border-emerald-500/50 active:scale-[0.99] p-2.5 flex flex-col justify-between text-left transition-all group shadow-sm">
                <div class="flex justify-start">
                  <mat-icon class="text-base text-sky-400">menu_book</mat-icon>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Docs OS</div>
                  <div class="text-[9px] text-sky-400 truncate">Especificações Locais</div>
                </div>
              </button>

            </div>
          </div>

        </div>

      </div>
    }
  `
})
export class OsStartMenuComponent {
  isOpen = input<boolean>(false);
  activeOperator = input<{ name?: string; role?: string } | null>(null);
  companyName = input<string>('');
  installedApps = input<{ id: string; name: string; description: string; icon?: string; category?: string }[]>([]);

  closeMenu = output<void>();
  launchApp = output<StartMenuAppItem>();
  openApp = output<string>();
  openFileExplorer = output<string | void>();
  openCalculator = output<void>();
  openBrowser = output<void>();
  openTaskManager = output<void>();
  openInstalledApps = output<void>();
  openSettings = output<void>();
  openStore = output<void>();
  searchWeb = output<string>();
  lockSystem = output<void>();
  refreshDesktop = output<void>();
  logoutSession = output<void>();

  isStartNavExpanded = signal<boolean>(false);
  isPowerMenuOpen = signal<boolean>(false);
  isUserMenuOpen = signal<boolean>(false);
  startMenuTab = signal<'all' | 'tiles'>('all');
  expandedFolders = signal<Record<string, boolean>>({ 'accessories': false, 'kernel': false });
  searchQuery = signal<string>('');

  filteredApps = computed<StartMenuAppItem[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const installed = this.installedApps();

    const systemApps: StartMenuAppItem[] = [
      { id: 'file_explorer', name: 'Explorador de Arquivos', desc: 'Gerenciador de arquivos, cupons fiscais e backups', icon: 'folder_open', color: 'bg-amber-600', isSystem: true },
      { id: 'browser', name: 'Docs & Especificações', desc: 'Central de documentação, regras de ouro e arquitetura local', icon: 'menu_book', color: 'bg-indigo-600', isSystem: true },
      { id: 'task_manager', name: 'Gerenciador de Tarefas', desc: 'Processos, serviços do kernel e telemetria', icon: 'view_timeline', color: 'bg-rose-700', isSystem: true },
      { id: 'calculator', name: 'Calculadora', desc: 'Operações matemáticas e cálculo comercial', icon: 'calculate', color: 'bg-teal-600', isSystem: true },
      { id: 'store', name: 'App Store', desc: 'Instale e remova novos módulos e apps da plataforma', icon: 'storefront', color: 'bg-sky-600', isSystem: true },
      { id: 'installed', name: 'Meus Aplicativos', desc: 'Catálogo de ferramentas e aplicativos instalados', icon: 'apps', color: 'bg-emerald-600', isSystem: true },
      { id: 'app_settings', name: 'Painel de Controle', desc: 'Configurações de rede, diagnósticos e periféricos', icon: 'settings', color: 'bg-slate-600', isSystem: true },
    ];

    const allApps: StartMenuAppItem[] = [
      ...systemApps,
      ...installed.map(app => ({
        id: app.id,
        name: app.name,
        desc: app.description,
        icon: app.icon || 'extension',
        color: this.getAppColor(app.category, app.id),
        isSystem: false
      }))
    ];

    if (!query) return allApps;
    return allApps.filter(app => 
      app.name.toLowerCase().includes(query) || 
      app.desc.toLowerCase().includes(query)
    );
  });

  recentlyAddedApps = computed(() => {
    return this.filteredApps().slice(0, 3);
  });

  alphabeticalAppsGrouped = computed(() => {
    const apps = this.filteredApps();
    const groups: Record<string, StartMenuAppItem[]> = {};

    for (const app of apps) {
      const firstChar = app.name.trim().charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(firstChar) ? firstChar : (/^[0-9]$/.test(firstChar) ? '#' : '&');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(app);
    }

    const keys = Object.keys(groups).sort((a, b) => {
      if (a === '&') return -1;
      if (b === '&') return 1;
      if (a === '#') return -1;
      if (b === '#') return 1;
      return a.localeCompare(b);
    });

    return keys.map(letter => ({
      letter,
      apps: groups[letter].sort((a, b) => a.name.localeCompare(b.name))
    }));
  });

  toggleStartNav() {
    this.isStartNavExpanded.update(v => !v);
  }

  togglePowerMenu() {
    this.isPowerMenuOpen.update(v => !v);
    this.isUserMenuOpen.set(false);
  }

  toggleUserMenu() {
    this.isUserMenuOpen.update(v => !v);
    this.isPowerMenuOpen.set(false);
  }

  toggleFolder(folderId: string) {
    this.expandedFolders.update(f => ({
      ...f,
      [folderId]: !f[folderId]
    }));
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input?.value || '');
  }

  openAppById(appId: string) {
    this.openApp.emit(appId);
    this.closeMenu.emit();
  }

  private getAppColor(category?: string, appId?: string): string {
    if (appId === 'app_pos' || category === 'SALES') return 'bg-indigo-600';
    if (appId === 'app_inventory' || category === 'INVENTORY') return 'bg-amber-600';
    if (appId === 'app_crm' || category === 'CRM') return 'bg-fuchsia-600';
    if (appId === 'app_finance' || category === 'FINANCE') return 'bg-emerald-600';
    if (appId === 'app_tables' || category === 'RESTAURANT') return 'bg-teal-600';
    if (appId === 'app_public_space' || category === 'PUBLIC_SPACE') return 'bg-violet-600';
    return 'bg-blue-600';
  }
}
