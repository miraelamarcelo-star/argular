import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { InventoryItem } from '../domain/inventory.entity';
import { GetInventoryItemsUseCase, AdjustStockUseCase } from '../application/inventory.usecases';
import { InventoryTableComponent } from './components/inventory-table.component';
import { InventoryAdjustModalComponent } from './components/inventory-adjust-modal.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    InventoryTableComponent, 
    InventoryAdjustModalComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans">
      <!-- Header -->
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <mat-icon class="text-[20px]">inventory_2</mat-icon>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-900 leading-tight">Controle de Estoque & Suprimentos</h2>
            <p class="text-[11px] text-slate-500 font-medium">Terminal Operacional · {{ app.companyName }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            [class]="app.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
            <span class="w-2 h-2 rounded-full" [class]="app.isOnline ? 'bg-emerald-500' : 'bg-amber-500'"></span>
            {{ app.isOnline ? 'Sincronizado' : 'Modo Local (Offline)' }}
          </div>

          <div class="h-4 w-px bg-slate-200"></div>

          <button
            (click)="reloadItems()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Atualizar Estoque">
            <mat-icon class="text-[18px]">refresh</mat-icon>
          </button>
        </div>
      </header>

      <!-- KPI Summary Cards Row -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3.5 p-4 md:px-6 bg-white border-b border-slate-200 shrink-0">
        <!-- Total Itens -->
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <span class="text-[11px] font-medium text-slate-500 block">Itens no Catálogo</span>
          <span class="text-lg font-bold text-slate-900 mt-0.5 block">{{ items().length }} produtos</span>
        </div>

        <!-- Alertas de Reposição -->
        <div class="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80">
          <span class="text-[11px] font-semibold text-rose-700 block flex items-center gap-1">
            <mat-icon class="text-[14px]">warning</mat-icon>
            Reposição Urgente
          </span>
          <span class="text-lg font-bold text-rose-900 mt-0.5 block">{{ lowStockCount() }} itens críticos</span>
        </div>

        <!-- Custo Total -->
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <span class="text-[11px] font-medium text-slate-500 block">Custo Total em Estoque</span>
          <span class="text-lg font-bold text-slate-800 mt-0.5 block">{{ totalCostValue() | currency:'BRL' }}</span>
        </div>

        <!-- Valor Venda Potencial -->
        <div class="p-3 bg-teal-50/60 rounded-xl border border-teal-200/80">
          <span class="text-[11px] font-semibold text-teal-800 block">Potencial de Venda</span>
          <span class="text-lg font-bold text-teal-900 mt-0.5 block">{{ totalSaleValue() | currency:'BRL' }}</span>
        </div>
      </section>

      <!-- Table Component -->
      <main class="flex-1 overflow-hidden">
        <app-inventory-table
          [items]="items()"
          (adjustStockRequested)="selectedItemForAdjustment.set($event)">
        </app-inventory-table>
      </main>

      <!-- Stock Adjust Modal Component -->
      <app-inventory-adjust-modal
        [item]="selectedItemForAdjustment()"
        (closed)="selectedItemForAdjustment.set(null)"
        (adjusted)="handleAdjustStock($event)">
      </app-inventory-adjust-modal>
    </div>
  `
})
export class InventoryComponent implements OnInit, OnDestroy {
  private osSdk = inject(OsSdkService);
  private getInventoryItemsUseCase = inject(GetInventoryItemsUseCase);
  private adjustStockUseCase = inject(AdjustStockUseCase);

  // Bind soberano ao OS através do SDK
  app: OsContext = this.osSdk.bind('app_inventory');

  private subs: { unsubscribe: () => void }[] = [];

  items = signal<InventoryItem[]>([]);
  selectedItemForAdjustment = signal<InventoryItem | null>(null);

  lowStockCount = computed(() => {
    return this.items().filter(i => i.stockQuantity <= i.minStock).length;
  });

  totalCostValue = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.costPrice * item.stockQuantity), 0);
  });

  totalSaleValue = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.salePrice * item.stockQuantity), 0);
  });

  async ngOnInit() {
    await this.reloadItems();

    // Reload inventory on any sale completion or manual stock update
    this.subs.push(
      this.app.events.subscribe('sale.completed', () => {
        this.reloadItems();
      }),
      this.app.events.subscribe('stock.item.save', () => {
        this.reloadItems();
      }),
      this.app.events.subscribe('stock.adjust', () => {
        this.reloadItems();
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async reloadItems() {
    try {
      const list = await this.getInventoryItemsUseCase.execute(this.app.companyId);
      this.items.set(list);
    } catch (e: unknown) {
      this.app.notify('Falha no Estoque', `Erro ao carregar itens: ${String(e)}`, 'error');
    }
  }

  async handleAdjustStock(event: { itemId: string; delta: number; reason: string }) {
    try {
      const updated = await this.adjustStockUseCase.execute(event.itemId, event.delta, event.reason, this.app.companyId);
      this.selectedItemForAdjustment.set(null);
      await this.reloadItems();

      const typeLabel = event.delta >= 0 ? 'Entrada' : 'Saída';
      this.app.notify(
        'Estoque Atualizado',
        `${typeLabel} de ${Math.abs(event.delta)} un. para ${updated.name} (Novo saldo: ${updated.stockQuantity})`,
        'success'
      );
    } catch (err: unknown) {
      this.app.notify('Erro no Ajuste', `Falha ao ajustar estoque: ${String(err)}`, 'error');
    }
  }
}
