import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-checkout-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-up">
        
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400">payments</mat-icon>
            <h3 class="text-sm font-bold">Encerrar & Receber: {{ table().name }}</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <!-- Total Card -->
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span class="text-xs text-emerald-800 font-bold uppercase tracking-wider">Valor Total da Mesa</span>
            <div class="text-2xl font-bold font-mono text-emerald-900 mt-1">
              R$ {{ (table().currentOrder?.total || 0) | number:'1.2-2' }}
            </div>
            @if ((table().currentOrder?.customerCount || 1) > 1) {
              <div class="text-xs text-emerald-700 font-mono mt-1">
                Dividido em {{ table().currentOrder?.customerCount }} pessoas: 
                <strong>R$ {{ (table().currentOrder?.perPersonTotal ?? ((table().currentOrder?.total || 0) / (table().currentOrder?.customerCount || 1))) | number:'1.2-2' }}</strong> por pessoa
              </div>
            }
          </div>

          <!-- Payment Method Selection -->
          <div>
            <label for="close-payment-method" class="block text-xs font-bold text-slate-700 mb-1">Forma de Pagamento</label>
            <select 
              id="close-payment-method"
              [value]="paymentMethod()"
              (change)="onPaymentMethodChange($event)"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="DINHEIRO">Dinheiro em Espécie</option>
              <option value="PIX">PIX Instantâneo</option>
              <option value="CARTAO_DEBITO">Cartão de Débito</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button 
              (click)="onConfirm()"
              class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-1">
              <mat-icon class="text-xs">check</mat-icon> Confirmar Pagamento & Liberar
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class TableCheckoutModalComponent {
  table = input.required<DiningTable>();

  closeModal = output<void>();
  confirm = output<string>();

  paymentMethod = signal<string>('DINHEIRO');

  onPaymentMethodChange(event: Event) {
    this.paymentMethod.set((event.target as HTMLSelectElement).value);
  }

  onConfirm() {
    this.confirm.emit(this.paymentMethod());
  }
}
