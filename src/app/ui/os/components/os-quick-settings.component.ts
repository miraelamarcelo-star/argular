import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-os-quick-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div class="absolute bottom-16 left-4 right-4 sm:left-auto sm:w-80 max-h-[calc(100vh-6rem)] overflow-y-auto z-50 rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl text-white p-4 space-y-4 animate-tray-slide">
        
        <div class="flex justify-between items-center border-b border-white/5 pb-2">
          <h3 class="text-xs font-bold text-slate-300">Painel de Controle Rápido</h3>
          <span class="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Core OS Engine</span>
        </div>

        <!-- Quick Toggles Matrix (2x2 Grid) -->
        <div class="grid grid-cols-2 gap-2">
          
          <!-- Toggle 1: Connection -->
          <button 
            (click)="toggleNetwork.emit()"
            [class]="isOnline() ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'"
            class="p-3 border rounded-xl flex flex-col gap-1 text-left transition-all">
            <mat-icon class="text-lg">{{ isOnline() ? 'wifi' : 'wifi_off' }}</mat-icon>
            <span class="text-[10px] font-bold">Conectividade</span>
            <span class="text-[9px] text-slate-300">{{ isOnline() ? 'Online' : 'Offline' }}</span>
          </button>

          <!-- Toggle 2: Printer Paper Status -->
          <button 
            (click)="togglePrinterPaper.emit()"
            [class]="hasPaper() ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/30' : 'bg-rose-950/55 text-rose-300 border-rose-500/30'"
            class="p-3 border rounded-xl flex flex-col gap-1 text-left transition-all">
            <mat-icon class="text-lg">print</mat-icon>
            <span class="text-[10px] font-bold">Bobina Térmica</span>
            <span class="text-[9px] text-slate-300">{{ hasPaper() ? 'Pronta' : 'Sem Papel' }}</span>
          </button>

          <!-- Toggle 3: Run Diagnostics -->
          <button 
            (click)="triggerDiagnostics.emit()"
            class="p-3 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col gap-1 text-left text-white transition-all">
            <mat-icon class="text-lg">analytics</mat-icon>
            <span class="text-[10px] font-bold">Diagnóstico</span>
            <span class="text-[9px] text-slate-400">Verificar Saúde</span>
          </button>

          <!-- Toggle 4: Reprint last job -->
          <button 
            (click)="reprintLastReceipt.emit()"
            class="p-3 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col gap-1 text-left text-white transition-all">
            <mat-icon class="text-lg">print_connect</mat-icon>
            <span class="text-[10px] font-bold">Reimprimir</span>
            <span class="text-[9px] text-slate-400">Segunda Via</span>
          </button>

        </div>

        <!-- Sliders section -->
        <div class="space-y-2 border-t border-white/5 pt-3">
          <div class="flex items-center gap-2 text-xs text-slate-300">
            <mat-icon class="text-sm">brightness_low</mat-icon>
            <input type="range" min="10" max="100" value="85" class="flex-1 accent-indigo-500 h-1 rounded bg-slate-750">
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-300">
            <mat-icon class="text-sm">volume_up</mat-icon>
            <input type="range" min="0" max="100" value="70" class="flex-1 accent-indigo-500 h-1 rounded bg-slate-750">
          </div>
        </div>

        <!-- Outbox Queue Console -->
        <div class="bg-slate-950/50 rounded-xl p-3 border border-white/5 space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-bold uppercase text-slate-400">Consolidar SaaS Central</span>
            <span class="text-[9px] font-mono font-bold text-amber-400">{{ outboxCount() }} ops</span>
          </div>
          <button 
            (click)="triggerManualSync.emit()"
            [disabled]="outboxCount() === 0"
            class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/5 disabled:text-slate-500 text-white font-bold text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-md">
            <mat-icon class="text-[12px]">sync</mat-icon>
            Sincronizar Fila Local
          </button>
        </div>

        <!-- Ajuste de Tela & Escala Inteligente -->
        <div class="space-y-2.5 border-t border-white/5 pt-3">
          <div class="flex justify-between items-center">
            <span class="text-[10px] font-bold uppercase text-slate-400">Ajuste de Tela & Escala</span>
            <button 
              (click)="toggleAutoFit.emit()"
              [class]="autoFitActive() ? 'text-indigo-400 font-bold' : 'text-slate-500 font-normal'"
              class="text-[9px] uppercase hover:underline flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="autoFitActive() ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'"></span>
              {{ autoFitActive() ? 'Auto-Ativo' : 'Desativado' }}
            </button>
          </div>

          <!-- Desktop Icon Size Switcher -->
          <div class="grid grid-cols-3 gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-white/5">
            <button 
              (click)="setDesktopIconSize.emit('small')"
              [class]="desktopIconSize() === 'small' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'"
              class="py-1 px-1.5 text-[9px] rounded-lg transition-all text-center">
              Compacto
            </button>
            <button 
              (click)="setDesktopIconSize.emit('normal')"
              [class]="desktopIconSize() === 'normal' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'"
              class="py-1 px-1.5 text-[9px] rounded-lg transition-all text-center">
              Padrão
            </button>
            <button 
              (click)="setDesktopIconSize.emit('large')"
              [class]="desktopIconSize() === 'large' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'"
              class="py-1 px-1.5 text-[9px] rounded-lg transition-all text-center">
              Expandido
            </button>
          </div>

          <!-- Manual Window Calibration button -->
          <div class="grid grid-cols-2 gap-1.5">
            <button 
              (click)="openDisplaySettings.emit(); closePanel.emit()"
              class="bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-[13px]">desktop_windows</mat-icon>
              Resolução Display
            </button>
            <button 
              (click)="autoFitWindows.emit(); closePanel.emit()"
              class="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-[13px]">aspect_ratio</mat-icon>
              Recalibrar Janelas
            </button>
          </div>
        </div>

        <!-- Wallpaper Selector -->
        <div class="space-y-1.5 border-t border-white/5 pt-3">
          <span class="text-[10px] font-bold uppercase text-slate-400">Papel de Parede</span>
          <div class="flex gap-2">
            @for (wp of wallpapers(); track wp.id) {
              <button 
                (click)="setWallpaper.emit(wp.css)"
                [title]="wp.name"
                [class]="activeWallpaper() === wp.css ? 'ring-2 ring-indigo-500' : ''"
                class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 transition-transform bg-slate-800 flex items-center justify-center">
                @if (wp.id === 'slate') {
                  <span class="text-[8px] font-bold">SL</span>
                } @else if (wp.id === 'grid') {
                  <span class="text-[8px] font-bold">GR</span>
                } @else {
                  <div class="w-full h-full bg-cover bg-center" [class]="wp.css"></div>
                }
              </button>
            }
          </div>
        </div>

      </div>
    }
  `
})
export class OsQuickSettingsComponent {
  isOpen = input<boolean>(false);
  isOnline = input<boolean>(true);
  hasPaper = input<boolean>(true);
  outboxCount = input<number>(0);
  autoFitActive = input<boolean>(true);
  desktopIconSize = input<'small' | 'normal' | 'large'>('normal');
  wallpapers = input<{ id: string; name: string; css: string }[]>([]);
  activeWallpaper = input<string>('');

  closePanel = output<void>();
  toggleNetwork = output<void>();
  togglePrinterPaper = output<void>();
  triggerDiagnostics = output<void>();
  reprintLastReceipt = output<void>();
  triggerManualSync = output<void>();
  toggleAutoFit = output<void>();
  setDesktopIconSize = output<'small' | 'normal' | 'large'>();
  openDisplaySettings = output<void>();
  autoFitWindows = output<void>();
  setWallpaper = output<string>();
}
