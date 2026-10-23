import { Component, ChangeDetectionStrategy, input, output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WindowState } from '../../../core/application/window-manager.service';
import { AppRegistryService } from '../../../core/app-runtime/app-registry.service';

@Component({
  selector: 'app-os-window-compositor',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Intelligent Snap Preview Zones -->
    @if (snapPreviewZone() === 'left') {
      <div class="fixed left-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-indigo-500/10 border-r-2 border-indigo-500/30 backdrop-blur-[2px] z-[9999] pointer-events-none animate-pulse"></div>
    } @else if (snapPreviewZone() === 'right') {
      <div class="fixed right-0 top-0 w-1/2 h-[calc(100vh-3.5rem)] bg-indigo-500/10 border-l-2 border-indigo-500/30 backdrop-blur-[2px] z-[9999] pointer-events-none animate-pulse"></div>
    }

    <!-- Window Manager Container -->
    <div class="absolute inset-0 pointer-events-none z-10">
      @for (win of windows(); track win.id) {
        @if (!win.isMinimized) {
          <div 
            [style.zIndex]="win.zIndex"
            [style.left]="win.isMaximized ? '0px' : (win.isSnapped === 'left' ? '0px' : (win.isSnapped === 'right' ? '50%' : getWindowX(win) + 'px'))"
            [style.top]="win.isMaximized ? '0px' : (win.isSnapped ? '0px' : getWindowY(win) + 'px')"
            [style.width]="win.isMaximized ? '100vw' : (win.isSnapped ? '50%' : getWindowWidth(win) + 'px')"
            [style.height]="win.isMaximized ? 'calc(100vh - 3.5rem)' : (win.isSnapped ? 'calc(100vh - 3.5rem)' : getWindowHeight(win) + 'px')"
            (mousedown)="focusWindow.emit(win.id)"
            [ngClass]="[
              topWindowId() === win.id ? 'shadow-2xl ring-2 ring-indigo-500/35 border-indigo-500/30' : 'shadow-lg border-slate-700/20 opacity-[0.98]',
              (win.isMaximized || win.isSnapped) ? 'rounded-none' : 'rounded-2xl border',
              activeDraggingId() === win.id ? 'opacity-70 scale-[0.99] border-dashed border-indigo-500 shadow-xl' : '',
              activeResizingId() === win.id ? 'border-dashed border-emerald-500 shadow-xl ring-2 ring-emerald-500/20' : ''
            ]"
            [class.transition-all]="activeDraggingId() !== win.id && activeResizingId() !== win.id"
            [class.duration-200]="activeDraggingId() !== win.id && activeResizingId() !== win.id"
            class="absolute bg-white flex flex-col overflow-hidden pointer-events-auto transform">
            
            <!-- Window Title Bar -->
            <div 
              (mousedown)="onStartDrag($event, win)"
              (dblclick)="toggleMaximize.emit(win.id)"
              class="h-11 bg-slate-900/95 text-white flex items-center justify-between px-4 border-b border-slate-800 select-none shrink-0 cursor-move">
              <div class="flex items-center gap-2.5 pointer-events-none">
                <div class="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <mat-icon class="text-[15px]">{{ win.icon }}</mat-icon>
                </div>
                <span class="text-xs font-bold text-slate-200 tracking-wide">{{ win.title }}</span>
                @if (win.isSnapped) {
                  <span class="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-600/25 text-indigo-300 tracking-wider">Ajustado</span>
                }
              </div>
              
              <div class="flex items-center gap-1">
                <!-- Align Left Button -->
                <button 
                  (click)="onTriggerSnap(win.id, win.isSnapped === 'left' ? null : 'left', $event)" 
                  title="Ajustar à Esquerda"
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[15px]">chevron_left</mat-icon>
                </button>
                <!-- Align Right Button -->
                <button 
                  (click)="onTriggerSnap(win.id, win.isSnapped === 'right' ? null : 'right', $event)" 
                  title="Ajustar à Direita"
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[15px]">chevron_right</mat-icon>
                </button>
                <!-- Minimize Button -->
                <button 
                  (click)="minimizeWindow.emit(win.id); $event.stopPropagation()" 
                  title="Minimizar"
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[16px]">remove</mat-icon>
                </button>
                <!-- Maximize / Restore Button -->
                <button 
                  (click)="toggleMaximize.emit(win.id); $event.stopPropagation()" 
                  [title]="win.isMaximized ? 'Restaurar' : 'Maximizar'"
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <mat-icon class="text-[15px]">{{ win.isMaximized ? 'filter_none' : 'crop_square' }}</mat-icon>
                </button>
                <!-- Close Button -->
                <button 
                  (click)="closeWindow.emit(win.id); $event.stopPropagation()" 
                  title="Fechar"
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-600 hover:text-white text-slate-400 transition-colors">
                  <mat-icon class="text-[16px]">close</mat-icon>
                </button>
              </div>
            </div>
            
            <!-- Window Content -->
            <div class="flex-1 overflow-auto bg-slate-50 relative">
              @let appId = win.componentId || win.id;
              @let status = appRegistry.loadingStates()[appId] || 'unloaded';

              @if (status === 'loading') {
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm z-50 gap-3">
                  <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <div class="text-xs font-semibold text-white tracking-wide">Iniciando ambiente...</div>
                </div>
              }

              @if (appRegistry.getComponent(appId); as dynamicComponent) {
                <ng-container *ngComponentOutlet="dynamicComponent"></ng-container>
              } @else if (status === 'failed') {
                <div class="p-12 text-center text-slate-400 space-y-2">
                  <mat-icon class="text-5xl text-rose-500">error_outline</mat-icon>
                  <p class="text-xs font-medium text-slate-700">Falha ao inicializar o aplicativo.</p>
                  <p class="text-[11px] text-slate-400">Ocorreu um erro ao carregar os recursos na rede.</p>
                </div>
              } @else {
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-indigo-500/5 backdrop-blur-[1px] z-50 gap-3">
                  <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <div class="text-[11px] font-semibold text-indigo-500/80 tracking-wide font-mono">Processando núcleo...</div>
                </div>
              }
            </div>

            <!-- Window Resize Handle (Bottom-Right) -->
            @if (!win.isMaximized && !win.isSnapped) {
              <div 
                (mousedown)="onStartResize($event, win)"
                class="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-50 text-slate-400 hover:text-indigo-400 transition-colors pointer-events-auto">
                <svg class="w-3.5 h-3.5 opacity-60 hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="6" y1="21" x2="21" y2="6"></line>
                  <line x1="12" y1="21" x2="21" y2="12"></line>
                  <line x1="18" y1="21" x2="21" y2="18"></line>
                </svg>
              </div>
            }

          </div>
        }
      }
    </div>
  `
})
export class OsWindowCompositorComponent {
  appRegistry = inject(AppRegistryService);

  windows = input.required<WindowState[]>();
  topWindowId = input<string | null>(null);
  activeDraggingId = input<string | null>(null);
  activeResizingId = input<string | null>(null);
  snapPreviewZone = input<'left' | 'right' | null>(null);
  dragPositions = input<Record<string, { x: number; y: number }>>({});
  dragSizes = input<Record<string, { width: number; height: number }>>({});

  focusWindow = output<string>();
  toggleMaximize = output<string>();
  minimizeWindow = output<string>();
  closeWindow = output<string>();
  triggerSnap = output<{ id: string; zone: 'left' | 'right' | null }>();
  startDrag = output<{ event: MouseEvent; window: WindowState }>();
  startResize = output<{ event: MouseEvent; window: WindowState }>();

  constructor() {
    effect(() => {
      const wins = this.windows();
      for (const win of wins) {
        const appId = win.componentId || win.id;
        const status = this.appRegistry.loadingStates()[appId] || 'unloaded';
        if (status === 'unloaded') {
          void this.appRegistry.loadComponent(appId);
        }
      }
    });
  }

  getWindowX(win: WindowState): number {
    return this.dragPositions()[win.id]?.x ?? win.x ?? 80;
  }

  getWindowY(win: WindowState): number {
    return this.dragPositions()[win.id]?.y ?? win.y ?? 40;
  }

  getWindowWidth(win: WindowState): number {
    return this.dragSizes()[win.id]?.width ?? win.width ?? 780;
  }

  getWindowHeight(win: WindowState): number {
    return this.dragSizes()[win.id]?.height ?? win.height ?? 540;
  }

  onStartDrag(event: MouseEvent, win: WindowState) {
    this.startDrag.emit({ event, window: win });
  }

  onStartResize(event: MouseEvent, win: WindowState) {
    this.startResize.emit({ event, window: win });
  }

  onTriggerSnap(id: string, zone: 'left' | 'right' | null, event: MouseEvent) {
    event.stopPropagation();
    this.triggerSnap.emit({ id, zone });
  }
}
