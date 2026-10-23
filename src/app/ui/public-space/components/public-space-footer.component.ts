import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PublicSpaceData } from './restaurant-template.component';

@Component({
  selector: 'app-public-space-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer id="contato" class="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
      <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
        
        <!-- Contact Detail Column -->
        <div class="space-y-4">
          <h4 class="text-white font-bold text-sm uppercase tracking-wider">Contato & Atendimento</h4>
          <div class="space-y-3 text-xs">
            @if (space().phone) {
              <div class="flex items-center gap-2">
                <mat-icon class="text-slate-500 text-[18px]">phone</mat-icon>
                <span>{{ space().phone }}</span>
              </div>
            }
            @if (space().email) {
              <div class="flex items-center gap-2">
                <mat-icon class="text-slate-500 text-[18px]">email</mat-icon>
                <span>{{ space().email }}</span>
              </div>
            }
            @if (space().address) {
              <div class="flex items-start gap-2">
                <mat-icon class="text-slate-500 text-[18px] mt-0.5">place</mat-icon>
                <span class="leading-relaxed">{{ space().address }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Opening Hours Column -->
        <div class="space-y-4">
          <h4 class="text-white font-bold text-sm uppercase tracking-wider">Horário de Funcionamento</h4>
          <div class="flex items-center gap-2 text-xs">
            <mat-icon class="text-slate-500 text-[18px]">schedule</mat-icon>
            <span>{{ space().hours || 'Segunda a Sexta: 08:00 às 18:00' }}</span>
          </div>
          <div class="pt-4 border-t border-slate-800">
            <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">STATUS OPERACIONAL</span>
            <div class="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-400 font-bold">
              <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Atendendo Normalmente</span>
            </div>
          </div>
        </div>

        <!-- Maps Column -->
        <div class="space-y-4">
          <h4 class="text-white font-bold text-sm uppercase tracking-wider">Localização Geográfica</h4>
          <a 
            [href]="'https://www.google.com/maps/search/?api=1&query=' + (space().address ? (space().title + ' ' + space().address) : space().title)"
            target="_blank"
            rel="noopener noreferrer"
            class="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4 transition-colors group cursor-pointer block">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <mat-icon>map</mat-icon>
              </div>
              <div>
                <span class="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors block">Exibir no Google Maps</span>
                <span class="text-[9px] text-slate-500">Abrir rota de navegação externa</span>
              </div>
            </div>
            <mat-icon class="text-slate-600 group-hover:text-slate-400 transition-colors text-sm">open_in_new</mat-icon>
          </a>
        </div>

      </div>

      <div class="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500">
        <span>&copy; 2026 {{ space().title }}. Hospedado de forma local-first sob infraestrutura 3eatcru OS.</span>
        <a routerLink="/" class="hover:text-slate-400 transition-colors flex items-center gap-1">
          <mat-icon class="text-[12px]">verified_user</mat-icon>
          Desenvolvido por 3eatcru
        </a>
      </div>
    </footer>
  `
})
export class PublicSpaceFooterComponent {
  space = input.required<PublicSpaceData>();
}
