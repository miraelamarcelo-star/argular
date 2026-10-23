import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowState } from '../../../core/application/window-manager.service';

@Component({
  selector: 'app-os-taskbar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="h-14 bg-slate-950/85 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-4 z-50 shrink-0 select-none">
      
      <!-- Start Button & Active Apps -->
      <div class="flex items-center gap-2 h-full">
        <button 
          (click)="toggleStartMenu.emit()"
          [class.bg-indigo-600]="isStartMenuOpen()"
          class="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-white transition-all shadow-md">
          <mat-icon>grid_view</mat-icon>
        </button>
        
        <div class="w-px h-6 bg-white/10 mx-2"></div>
        
        <!-- Open Windows list in Taskbar -->
        <div class="flex items-center gap-1.5 overflow-x-auto max-w-lg md:max-w-2xl no-scrollbar">
          @for (win of windows(); track win.id) {
            <button 
              (click)="toggleWindow.emit(win.id)"
              (mouseenter)="hoveredTaskbarAppId.set(win.id)"
              (mouseleave)="hoveredTaskbarAppId.set(null)"
              [class]="topWindowId() === win.id && !win.isMinimized ? 'bg-white/20 border-indigo-500/50 shadow-inner text-white' : win.isMinimized ? 'bg-white/5 border-white/5 text-slate-400 opacity-75 hover:opacity-100 hover:bg-white/10' : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/15'"
              class="h-10 px-3 rounded-xl flex items-center gap-2 border transition-all duration-300 ease-out hover:scale-105 active:scale-95 max-w-[160px] shrink-0 text-left relative group">
              <div class="w-5 h-5 rounded flex items-center justify-center bg-indigo-500/20 text-indigo-300 shrink-0">
                <mat-icon class="text-xs">{{ win.icon }}</mat-icon>
              </div>
              <span class="text-xs font-medium truncate">{{ win.title }}</span>
              @if (topWindowId() === win.id && !win.isMinimized) {
                <span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-indigo-400"></span>
              }
            </button>
          }
        </div>
      </div>
      
      <!-- Live Taskbar Hover Preview Card -->
      @if (hoveredWindow(); as win) {
        <div 
          (mouseenter)="hoveredTaskbarAppId.set(win.id)"
          (mouseleave)="hoveredTaskbarAppId.set(null)"
          class="absolute bottom-16 left-16 z-50 w-64 rounded-2xl bg-slate-900/95 border border-white/10 p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in space-y-3 pointer-events-auto">
          
          <!-- Card Header -->
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <mat-icon class="text-sm">{{ win.icon }}</mat-icon>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-white truncate">{{ win.title }}</h4>
              <p class="text-[9px] uppercase tracking-wider font-mono text-indigo-400">
                {{ win.isMinimized ? 'Minimizado' : (topWindowId() === win.id ? 'Ativo na Tela' : 'Em Segundo Plano') }}
              </p>
            </div>
          </div>

          <!-- Quick Thumbnail Simulator -->
          <div class="w-full h-24 rounded-lg bg-slate-950/60 border border-white/5 flex flex-col items-center justify-center p-3 relative overflow-hidden group">
            <mat-icon class="text-3xl text-slate-700 group-hover:scale-110 transition-transform">{{ win.icon }}</mat-icon>
            <span class="text-[9px] text-slate-500 mt-2">Visualização do App</span>
            <div class="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <!-- Quick Action Commands directly in preview -->
          <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5">
            <button 
              (click)="toggleWindow.emit(win.id); hoveredTaskbarAppId.set(null)"
              class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-[12px]">{{ win.isMinimized ? 'unfold_more' : 'unfold_less' }}</mat-icon>
              {{ win.isMinimized ? 'Restaurar' : 'Minimizar' }}
            </button>
            <button 
              (click)="closeWindow.emit(win.id); hoveredTaskbarAppId.set(null)"
              class="bg-rose-950 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold text-[10px] py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1">
              <mat-icon class="text-[12px]">close</mat-icon>
              Fechar
            </button>
          </div>
        </div>
      }

      <!-- System Tray -->
      <div class="flex items-center gap-2 text-white shrink-0">
        
        <!-- Keyboard Shortcuts HUD Trigger -->
        <button 
          (click)="toggleShortcutHud.emit()"
          [class.bg-indigo-600]="isShortcutHudOpen()"
          title="Atalhos do Teclado (Alt + /)"
          class="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all group relative shrink-0"
          type="button">
          <mat-icon class="text-[17px] group-hover:scale-110 transition-transform">keyboard</mat-icon>
          <span class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-indigo-400 border-2 border-slate-900 animate-pulse"></span>
        </button>
        
        <!-- Company Context button -->
        <button (click)="toggleTray.emit()" class="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 text-left" type="button">
          <div class="flex flex-col text-right hidden sm:flex">
            <span class="text-[10px] font-bold text-slate-200">
              {{ companyName() }}
              @if (branchName()) {
                <span class="text-indigo-300 font-normal">({{ branchName() }})</span>
              }
            </span>
            <span class="text-[9px] text-emerald-400 font-medium flex items-center gap-0.5 justify-end">
              <span class="w-1 h-1 bg-emerald-400 rounded-full"></span>
              {{ isOnline() ? 'Online' : 'Offline' }}
            </span>
          </div>
          <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <mat-icon class="text-[15px]">business</mat-icon>
          </div>
        </button>
        
        <!-- Quick Settings Toggles Cluster (Wi-Fi, Spooler) -->
        <button 
          (click)="toggleTray.emit()" 
          [class.bg-white/10]="isTrayOpen()"
          title="Painel de Controle Rápido (Rede e Periféricos)"
          class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 text-slate-300" 
          type="button">
          <mat-icon class="text-[16px]" [class.text-indigo-400]="isOnline()" [class.text-slate-500]="!isOnline()">
            {{ isOnline() ? 'wifi' : 'wifi_off' }}
          </mat-icon>
          <mat-icon class="text-[16px]" [class.text-emerald-400]="hasPaper()" [class.text-rose-400]="!hasPaper()">
            print
          </mat-icon>
        </button>

        <!-- Calendar & Notification Center Trigger (Clock, Date, Notif Count) -->
        <button 
          (click)="toggleCalendar.emit()" 
          [class.bg-white/10]="isCalendarOpen()"
          title="Calendário e Central de Notificações (Alt + N)"
          class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5 font-mono text-slate-300 text-left relative group" 
          type="button">
          
          <!-- Notification indicator badge -->
          @if (notificationCount() > 0) {
            <span class="w-2 h-2 rounded-full bg-indigo-400 border border-slate-900 absolute -top-0.5 -right-0.5 animate-pulse"></span>
          }

          <mat-icon class="text-[16px] text-slate-400 group-hover:text-white transition-colors">notifications_none</mat-icon>
          
          <div class="flex flex-col text-center pl-1.5 border-l border-white/10">
            <span class="text-xs font-bold text-white tracking-wider leading-none">{{ currentTime() }}</span>
            <span class="text-[8px] text-slate-400 font-sans tracking-wide mt-0.5">{{ currentDate() }}</span>
          </div>
        </button>

        <!-- Show Desktop Bar (Windows style ultra-subtle button) -->
        <button 
          (click)="toggleShowDesktop.emit()"
          [title]="isDesktopShown() ? 'Restaurar todas as janelas' : 'Minimizar todas as janelas (Mostrar Área de Trabalho)'"
          [class.bg-indigo-600]="isDesktopShown()"
          class="w-4 h-10 hover:bg-white/10 border-l border-white/10 rounded-r flex items-center justify-center text-slate-500 hover:text-white transition-all duration-250 ml-1.5 group shrink-0"
          type="button">
          <div class="w-1 h-6 bg-white/10 group-hover:bg-indigo-400 rounded transition-colors"></div>
        </button>

      </div>
      
    </footer>
  `
})
export class OsTaskbarComponent {
  windows = input.required<WindowState[]>();
  topWindowId = input<string | null>(null);
  isStartMenuOpen = input<boolean>(false);
  isTrayOpen = input<boolean>(false);
  isCalendarOpen = input<boolean>(false);
  isShortcutHudOpen = input<boolean>(false);
  isDesktopShown = input<boolean>(false);
  companyName = input<string>('');
  branchName = input<string | undefined>(undefined);
  isOnline = input<boolean>(true);
  hasPaper = input<boolean>(true);
  notificationCount = input<number>(0);
  currentTime = input<string>('');
  currentDate = input<string>('');

  toggleStartMenu = output<void>();
  toggleTray = output<void>();
  toggleCalendar = output<void>();
  toggleShortcutHud = output<void>();
  toggleShowDesktop = output<void>();
  toggleWindow = output<string>();
  closeWindow = output<string>();

  hoveredTaskbarAppId = signal<string | null>(null);

  hoveredWindow = computed(() => {
    const id = this.hoveredTaskbarAppId();
    if (!id) return null;
    return this.windows().find(w => w.id === id) || null;
  });
}
