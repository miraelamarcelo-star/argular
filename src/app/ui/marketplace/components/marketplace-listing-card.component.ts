import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface ListingCapabilities {
  delivery: boolean;
  pickup: boolean;
  booking: boolean;
}

export interface MarketplaceListingItem {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: string;
  status: string;
  category: 'Restaurantes' | 'Varejo' | 'Serviços' | 'Outros';
  subCategory: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinates: { lat: number; lng: number };
  capabilities: ListingCapabilities;
  rating: number;
  deliveryTimeMin: string;
  deliveryFee: number;
  productsCount: number;
  calculatedDistance: number;
  isOpen?: boolean;
}

@Component({
  selector: 'app-marketplace-listing-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between">
      <!-- Content Info -->
      <div class="p-6 space-y-4">
        <!-- Card Header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <img 
              [src]="item().logo" 
              [alt]="item().title"
              referrerpolicy="no-referrer"
              class="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0">
            <div>
              <span class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                {{ item().category }}
              </span>
              <h4 class="font-extrabold text-slate-900 tracking-tight leading-snug mt-1">{{ item().title }}</h4>
              <p class="text-[11px] text-slate-500">{{ item().subCategory }}</p>
            </div>
          </div>
          
          <div class="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold shrink-0">
            <mat-icon class="text-xs text-amber-500">star</mat-icon>
            <span>{{ item().rating }}</span>
          </div>
        </div>
 
        <!-- Description -->
        <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {{ item().description }}
        </p>
 
        <!-- Location & Calculated Distance -->
        <div class="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
          <div class="flex items-center gap-1.5 text-slate-700 font-medium">
            <mat-icon class="text-xs text-slate-400">location_on</mat-icon>
            <span class="truncate">{{ item().address }}</span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-5">
            <span>Distância: <strong class="text-indigo-600">{{ item().calculatedDistance.toFixed(1) }} km</strong></span>
            <span>•</span>
            <span>Status: <strong [class]="item().isOpen ? 'text-emerald-600' : 'text-rose-600'">{{ item().isOpen ? 'Aberto' : 'Fechado' }}</strong></span>
          </div>
        </div>

        <!-- Active Capabilities Badges -->
        <div class="flex flex-wrap gap-1.5 pt-2">
          @if (item().capabilities.delivery) {
            <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 uppercase">
              <mat-icon class="text-xs">delivery_dining</mat-icon> Entrega
            </span>
          }
          @if (item().capabilities.pickup) {
            <span class="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 uppercase">
              <mat-icon class="text-xs">storefront</mat-icon> Retirada
            </span>
          }
          @if (item().capabilities.booking) {
            <span class="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 uppercase">
              <mat-icon class="text-xs">calendar_today</mat-icon> Agendamento
            </span>
          }
        </div>
      </div>

      <!-- Action Footer -->
      <div class="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <div class="text-xs text-slate-500">
          @if (item().capabilities.delivery) {
            <span class="block">Entrega: <strong class="text-slate-800">{{ item().deliveryFee === 0 ? 'Grátis' : 'R$ ' + item().deliveryFee.toFixed(2) }}</strong></span>
            <span class="block text-[10px] text-slate-400">Estimado: {{ item().deliveryTimeMin }}</span>
          } @else {
            <span class="block text-slate-400 italic">Somente local</span>
          }
        </div>
        
        <a 
          [routerLink]="['/public', item().companySlug]"
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
          Ver Site Público
          <mat-icon class="text-xs">open_in_new</mat-icon>
        </a>
      </div>
    </div>
  `
})
export class MarketplaceListingCardComponent {
  item = input.required<MarketplaceListingItem>();
}
