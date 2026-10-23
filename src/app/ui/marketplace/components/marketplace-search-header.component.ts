import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-marketplace-search-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
      <!-- Top Search and Sort -->
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="relative w-full sm:max-w-md">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <mat-icon class="text-sm">search</mat-icon>
          </span>
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            placeholder="Buscar por nome, subcategoria, especialidade..." 
            class="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors">
        </div>
        
        <div class="flex items-center gap-2 text-xs shrink-0 self-end sm:self-auto">
          <label for="marketplace-sort-select" class="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Ordenar por:</label>
          <select 
            id="marketplace-sort-select"
            [value]="sortBy()"
            (change)="onSortChange($event)"
            class="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 focus:outline-none text-slate-800 font-medium">
            <option value="rating">Melhor Avaliação ⭐</option>
            <option value="distance">Distância Mínima 📍</option>
            <option value="name">Ordem Alfabética [A-Z]</option>
          </select>
        </div>
      </div>

      <!-- Categories horizontal list -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        @for (cat of categories; track cat) {
          <button 
            type="button"
            (click)="categoryChange.emit(cat)"
            [class.bg-indigo-600]="selectedCategory() === cat"
            [class.text-white]="selectedCategory() === cat"
            [class.bg-slate-100]="selectedCategory() !== cat"
            [class.text-slate-600]="selectedCategory() !== cat"
            [class.hover:bg-slate-200]="selectedCategory() !== cat"
            class="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none whitespace-nowrap">
            @if (cat === 'Restaurantes') { 🍕 }
            @else if (cat === 'Varejo') { 🛍 }
            @else if (cat === 'Serviços') { 💇 }
            @else if (cat === 'Outros') { 📦 }
            {{ cat }}
          </button>
        }
      </div>
    </div>
  `
})
export class MarketplaceSearchHeaderComponent {
  searchQuery = input.required<string>();
  sortBy = input.required<'rating' | 'distance' | 'name'>();
  selectedCategory = input.required<string>();

  searchQueryChange = output<string>();
  sortByChange = output<'rating' | 'distance' | 'name'>();
  categoryChange = output<string>();

  categories = ['Todos', 'Restaurantes', 'Varejo', 'Serviços', 'Outros'];

  onSearchInput(event: Event) {
    this.searchQueryChange.emit((event.target as HTMLInputElement).value);
  }

  onSortChange(event: Event) {
    this.sortByChange.emit((event.target as HTMLSelectElement).value as 'rating' | 'distance' | 'name');
  }
}
