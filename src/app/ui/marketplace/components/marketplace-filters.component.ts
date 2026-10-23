import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface LocationPreset {
  name: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-marketplace-filters',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="space-y-6">
      <!-- Geolocation Simulation Panel -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-4 text-slate-800">
          <mat-icon class="text-indigo-600">location_on</mat-icon>
          <h3 class="font-bold text-sm tracking-tight">Sua Localização</h3>
        </div>
        
        <p class="text-xs text-slate-500 mb-3 leading-relaxed">
          Simule onde você está para calcular a distância e o tempo de entrega dos estabelecimentos locais:
        </p>
        
        <!-- Location preset list -->
        <div class="space-y-2 mb-4">
          @for (loc of simulatedLocations(); track loc.name) {
            <button 
              type="button"
              (click)="locationChange.emit(loc)"
              [class.bg-indigo-50]="selectedLocation().name === loc.name"
              [class.border-indigo-500]="selectedLocation().name === loc.name"
              [class.text-indigo-700]="selectedLocation().name === loc.name"
              class="w-full text-left text-xs px-3 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all flex items-center justify-between">
              <span class="truncate">{{ loc.name }}</span>
              @if (selectedLocation().name === loc.name) {
                <mat-icon class="text-sm">done</mat-icon>
              }
            </button>
          }
        </div>

        <!-- Distance Range Slider -->
        <div class="pt-3 border-t border-slate-100">
          <div class="flex justify-between items-center text-xs mb-1.5 font-semibold text-slate-600">
            <label for="distance-slider">Distância Máxima:</label>
            <span class="text-indigo-600 font-bold font-mono">{{ maxDistance() }} km</span>
          </div>
          <input 
            id="distance-slider"
            type="range" 
            min="1" 
            max="30" 
            [value]="maxDistance()"
            (input)="onDistanceInput($event)"
            class="w-full accent-indigo-600 cursor-pointer">
          <div class="flex justify-between text-[10px] text-slate-400 font-bold">
            <span>1 km</span>
            <span>15 km</span>
            <span>30 km</span>
          </div>
        </div>
      </div>

      <!-- Capabilities & Operating filters -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-4 text-slate-800">
          <mat-icon class="text-indigo-600">tune</mat-icon>
          <h3 class="font-bold text-sm tracking-tight">Capacidades & Filtros</h3>
        </div>

        <div class="space-y-3">
          <!-- Delivery Checkbox -->
          <label class="flex items-center gap-3 text-xs text-slate-600 hover:text-slate-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterDelivery()"
              (change)="onDeliveryChange($event)"
              class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4">
            <span class="flex items-center gap-1 font-medium">
              <mat-icon class="text-xs text-slate-400">delivery_dining</mat-icon>
              Suporta Entrega (Delivery)
            </span>
          </label>

          <!-- Pickup Checkbox -->
          <label class="flex items-center gap-3 text-xs text-slate-600 hover:text-slate-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterPickup()"
              (change)="onPickupChange($event)"
              class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4">
            <span class="flex items-center gap-1 font-medium">
              <mat-icon class="text-xs text-slate-400">storefront</mat-icon>
              Suporta Retirada (Takeout)
            </span>
          </label>

          <!-- Booking Checkbox -->
          <label class="flex items-center gap-3 text-xs text-slate-600 hover:text-slate-950 cursor-pointer select-none">
            <input 
              type="checkbox" 
              [checked]="filterBooking()"
              (change)="onBookingChange($event)"
              class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4">
            <span class="flex items-center gap-1 font-medium">
              <mat-icon class="text-xs text-slate-400">calendar_today</mat-icon>
              Suporta Agendamento
            </span>
          </label>

          <!-- Open Now Checkbox -->
          <label class="flex items-center gap-3 text-xs text-slate-600 hover:text-slate-950 cursor-pointer select-none pt-3 border-t border-slate-100">
            <input 
              type="checkbox" 
              [checked]="filterOpenNow()"
              (change)="onOpenNowChange($event)"
              class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4">
            <span class="flex items-center gap-1 font-medium">
              <mat-icon class="text-xs text-slate-400">schedule</mat-icon>
              Aberto Agora
            </span>
          </label>
        </div>
      </div>
    </aside>
  `
})
export class MarketplaceFiltersComponent {
  simulatedLocations = input.required<LocationPreset[]>();
  selectedLocation = input.required<LocationPreset>();
  maxDistance = input.required<number>();
  filterDelivery = input.required<boolean>();
  filterPickup = input.required<boolean>();
  filterBooking = input.required<boolean>();
  filterOpenNow = input.required<boolean>();

  locationChange = output<LocationPreset>();
  maxDistanceChange = output<number>();
  filterDeliveryChange = output<boolean>();
  filterPickupChange = output<boolean>();
  filterBookingChange = output<boolean>();
  filterOpenNowChange = output<boolean>();

  onDistanceInput(event: Event) {
    this.maxDistanceChange.emit(Number((event.target as HTMLInputElement).value));
  }

  onDeliveryChange(event: Event) {
    this.filterDeliveryChange.emit((event.target as HTMLInputElement).checked);
  }

  onPickupChange(event: Event) {
    this.filterPickupChange.emit((event.target as HTMLInputElement).checked);
  }

  onBookingChange(event: Event) {
    this.filterBookingChange.emit((event.target as HTMLInputElement).checked);
  }

  onOpenNowChange(event: Event) {
    this.filterOpenNowChange.emit((event.target as HTMLInputElement).checked);
  }
}
