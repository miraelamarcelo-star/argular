import { Component, inject, signal, computed } from '@angular/core';
import { OsStateService } from './os-state.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

import { WindowManagerService } from './core/application/window-manager.service';
import { AppCatalogItem } from './core/domain/store/app-manifest.entity';

@Component({
  selector: 'app-installed',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  template: `
    <div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      <!-- Top Banner -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <mat-icon class="text-sm">verified</mat-icon>
            Módulos Ativos no Terminal
          </div>
          <h2 class="text-2xl font-bold tracking-tight text-white">Meus Aplicativos</h2>
          <p class="text-xs text-slate-300 max-w-xl">
            Gerencie as aplicações carregadas no runtime deste terminal. Aplicativos possuem isolamento de dados e operam localmente com sincronização inteligente.
          </p>
        </div>

        <div class="flex items-center gap-3 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl shrink-0">
          <div class="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <mat-icon>layers</mat-icon>
          </div>
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400">Total Instalados</span>
            <div class="text-lg font-bold font-mono text-white">{{ state.installedAppsList().length }} apps</div>
          </div>
        </div>
      </div>

      <!-- Controls & Search -->
      <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="relative w-full sm:w-80">
          <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Filtrar aplicativos instalados..." 
            class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm">
        </div>

        <div class="text-xs text-slate-500">
          Status do Sistema: <strong class="text-emerald-600">Runtime Ativo & Saudável</strong>
        </div>
      </div>

      <!-- Apps Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (app of filteredApps(); track app.id) {
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-lg hover:border-emerald-200 transition-all duration-200 group">
            
            <div class="p-6 flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 group-hover:bg-emerald-50/20 transition-colors">
              <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
                <mat-icon class="text-2xl">{{ app.icon }}</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-slate-900 text-sm truncate">{{ app.name }}</h3>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ativo no OS
                  </span>
                  <span class="text-[10px] text-slate-400 font-mono">v{{ getInstalledVersion(app.id) }}</span>
                </div>
              </div>
            </div>
            
            <div class="p-6 mt-auto flex-1 flex flex-col justify-between space-y-4">
              <p class="text-slate-600 text-xs leading-relaxed">{{ app.description }}</p>

              <div class="flex gap-2 pt-2 border-t border-slate-100">
                <button 
                  (click)="openApp(app)"
                  class="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm">
                  <mat-icon class="text-sm text-emerald-400">play_arrow</mat-icon>
                  Executar
                </button>
                <button 
                  (click)="state.uninstallApp(app.id)"
                  class="flex items-center justify-center px-3 py-2.5 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-colors"
                  title="Desinstalar Aplicativo">
                  <mat-icon class="text-sm">delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        }

        @if (filteredApps().length === 0) {
          <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
            <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <mat-icon class="text-3xl">apps</mat-icon>
            </div>
            <h4 class="text-sm font-bold text-slate-700">Nenhum aplicativo encontrado</h4>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              Acesse a App Store para instalar novos módulos no seu workspace.
            </p>
          </div>
        }
      </div>
    </div>
  `
})
export class InstalledAppsComponent {
  state = inject(OsStateService);
  windowManager = inject(WindowManagerService);
  searchQuery = signal('');

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  filteredApps = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const apps = this.state.installedAppsList();
    if (!q) return apps;
    return apps.filter(a => 
      a.name.toLowerCase().includes(q) || 
      a.description.toLowerCase().includes(q)
    );
  });

  openApp(app: AppCatalogItem) {
    this.windowManager.openWindow(app.id, app.name, app.icon);
  }

  getInstalledVersion(appId: string): string {
    const item = this.state.storeAppsWithStatus().find(s => s.app.id === appId);
    return item?.installedVersion || item?.installation?.installedVersion || item?.app.currentRelease?.version || '1.0.0';
  }
}
