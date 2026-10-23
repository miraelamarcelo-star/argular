import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface AppShortcut {
  id: string;
  name: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-os-desktop-shortcuts',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main 
      (contextmenu)="onContextMenu($event)" 
      class="flex-1 relative p-6 flex flex-col flex-wrap gap-6 content-start z-0 overflow-y-auto">
      
      <!-- Desktop Shortcut: Este Computador / Explorador de Arquivos -->
      <button (click)="openFileExplorer.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-amber-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">folder_open</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Este Computador</span>
      </button>

      <!-- Desktop Shortcut: App Store / Marketplace -->
      <button (click)="openStore.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-indigo-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">storefront</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">App Store</span>
      </button>

      <!-- Desktop Shortcut: Navegador Web Inteligente -->
      <button (click)="openBrowser.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-blue-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">public</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Navegador</span>
      </button>

      <!-- Desktop Shortcut: Meus Aplicativos -->
      <button (click)="openInstalledApps.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-emerald-600/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">apps</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Meus Apps</span>
      </button>

      <!-- Desktop Shortcut: Painel de Controle -->
      <button (click)="openSettings.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-slate-700/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">settings</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Painel de Controle</span>
      </button>

      <!-- Desktop Shortcut: Gerenciador de Tarefas -->
      <button (click)="openTaskManager.emit(); $event.stopPropagation()" 
        [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
        class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
        <div 
          [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
          class="bg-rose-700/90 shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform">
          <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                    class="leading-none flex items-center justify-center">view_timeline</mat-icon>
        </div>
        <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
              class="text-white font-semibold drop-shadow-md text-center leading-tight">Tarefas OS</span>
      </button>

      <!-- Desktop Shortcuts Dinâmicos dos Aplicativos Instalados -->
      @for (app of installedAppShortcuts(); track app.id) {
        <button (click)="openApp.emit(app); $event.stopPropagation()" 
          [ngClass]="desktopIconSize() === 'small' ? 'w-16 p-1 gap-1' : desktopIconSize() === 'large' ? 'w-24 p-3 gap-2' : 'w-20 p-2 gap-1.5'"
          class="flex flex-col items-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-all group">
          <div 
            [ngClass]="desktopIconSize() === 'small' ? 'w-10 h-10 rounded-lg' : desktopIconSize() === 'large' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'"
            class="shadow-md flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-105 transition-transform" [ngClass]="app.color">
            <mat-icon [style.fontSize]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      [style.width]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      [style.height]="desktopIconSize() === 'small' ? '18px' : desktopIconSize() === 'large' ? '30px' : '24px'"
                      class="leading-none flex items-center justify-center">{{ app.icon }}</mat-icon>
          </div>
          <span [ngClass]="desktopIconSize() === 'small' ? 'text-[10px]' : desktopIconSize() === 'large' ? 'text-xs' : 'text-[11px]'"
                class="text-white font-semibold drop-shadow-md text-center leading-tight">{{ app.name }}</span>
        </button>
      }

      <!-- Quick Status Overlay Widget on Desktop -->
      <div class="absolute top-6 right-6 p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/10 text-white w-64 space-y-3 pointer-events-auto shadow-xl hidden md:block">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <span class="text-[10px] font-bold uppercase text-slate-300 tracking-wider">Status do Terminal</span>
          <span class="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Modelo OS:</span>
            <span class="font-semibold text-slate-200">3eatcru OS Pro</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Licença:</span>
            <span class="font-semibold text-indigo-400">Enterprise Ativa</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Impressora:</span>
            <span [class]="isPrinterOnline() ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'">
              {{ isPrinterOnline() ? 'Pronta (80mm)' : 'Offline/Sem Papel' }}
            </span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Outbox Queue:</span>
            <span class="font-mono font-bold text-amber-400">{{ outboxLength() }} ops</span>
          </div>
        </div>
      </div>
    </main>
  `
})
export class OsDesktopShortcutsComponent {
  desktopIconSize = input<'small' | 'normal' | 'large'>('normal');
  installedAppShortcuts = input<AppShortcut[]>([]);
  isPrinterOnline = input<boolean>(true);
  outboxLength = input<number>(0);

  openFileExplorer = output<void>();
  openStore = output<void>();
  openBrowser = output<void>();
  openInstalledApps = output<void>();
  openSettings = output<void>();
  openTaskManager = output<void>();
  openApp = output<AppShortcut>();
  contextMenu = output<MouseEvent>();

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.contextMenu.emit(event);
  }
}
