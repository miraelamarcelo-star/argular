import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../domain/pos.entity';

export interface PosCustomerOption {
  id: string;
  name: string;
  points: number;
  tier: string;
}

@Component({
  selector: 'app-pos-cart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <aside class="w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs">
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <mat-icon class="text-indigo-600 text-[20px]">shopping_cart</mat-icon>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wider">Itens do Pedido</h3>
        </div>
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
          {{ cart().length }} {{ cart().length === 1 ? 'item' : 'itens' }}
        </span>
      </div>

      <!-- Items List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
        @for (item of cart(); track item.product.id) {
          <div class="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-2 hover:border-slate-300 transition-colors">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-slate-800 truncate">{{ item.product.name }}</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                {{ item.product.price | currency:'BRL' }} un.
              </div>
            </div>

            <!-- Quantity Controls -->
            <div class="flex items-center gap-1">
              <button
                (click)="updateQuantity(item.product.id, -1)"
                class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                <mat-icon class="text-[14px]">remove</mat-icon>
              </button>
              <span class="w-6 text-center text-xs font-bold text-slate-800">{{ item.quantity }}</span>
              <button
                (click)="updateQuantity(item.product.id, 1)"
                class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                <mat-icon class="text-[14px]">add</mat-icon>
              </button>
            </div>

            <div class="text-right min-w-[70px]">
              <div class="text-xs font-bold text-slate-900">
                {{ (item.quantity * item.product.price) | currency:'BRL' }}
              </div>
            </div>
          </div>
        }
        @if (cart().length === 0) {
          <div class="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
            <mat-icon class="text-3xl text-slate-300 mb-1">remove_shopping_cart</mat-icon>
            Nenhum produto adicionado
          </div>
        }
      </div>

      <!-- Quick Hardware Actions Bar -->
      <div class="px-4 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px]">
        <button
          (click)="openDrawer.emit()"
          class="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium cursor-pointer">
          <mat-icon class="text-[16px]">point_of_sale</mat-icon>
          Abrir Gaveta
        </button>
        <button
          (click)="readScale.emit()"
          class="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium cursor-pointer">
          <mat-icon class="text-[16px]">scale</mat-icon>
          Ler Balança
        </button>
      </div>

      <!-- Customer Loyalty Selector -->
      <div class="p-4 border-t border-slate-200 bg-slate-50/50 space-y-1.5">
        <label for="pos-customer-selector" class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <mat-icon class="text-violet-600 text-[16px]">loyalty</mat-icon>
          Cliente / Fidelidade
        </label>
        <select
          id="pos-customer-selector"
          [value]="selectedCustomerId()"
          (change)="onCustomerChange($event)"
          class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
          <option value="">Consumidor Não Identificado</option>
          @for (cust of customers(); track cust.id) {
            <option [value]="cust.id">
              {{ cust.name }} ({{ cust.points }} pts - {{ cust.tier }})
            </option>
          }
        </select>
      </div>

      <!-- Payment Method Selector -->
      <div class="p-4 border-t border-slate-200 bg-white space-y-1.5">
        <label for="pos-payment-method" class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <mat-icon class="text-indigo-600 text-[16px]">payments</mat-icon>
          Forma de Pagamento
        </label>
        <div class="grid grid-cols-2 gap-1.5">
          @for (method of paymentMethods; track method.id) {
            <button
              (click)="selectedPaymentMethod = method.id; paymentMethodChange.emit(method.id)"
              [class]="selectedPaymentMethod === method.id
                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'"
              class="border rounded-lg p-2 text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-left">
              <mat-icon class="text-[16px]">{{ method.icon }}</mat-icon>
              <span>{{ method.name }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Checkout Footer -->
      <div class="p-4 border-t border-slate-200 bg-slate-50">
        <div class="flex justify-between items-baseline mb-3">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total a Pagar</span>
          <span class="text-2xl font-bold text-slate-900">{{ total() | currency:'BRL' }}</span>
        </div>

        <button
          [disabled]="cart().length === 0 || isProcessing()"
          (click)="checkout.emit()"
          class="w-full bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]">
          @if (isProcessing()) {
            <mat-icon class="animate-spin text-[20px]">autorenew</mat-icon>
            Processando Venda...
          } @else {
            <mat-icon class="text-[20px]">check_circle</mat-icon>
            Finalizar & Imprimir Cupom
          }
        </button>
      </div>
    </aside>
  `
})
export class PosCartComponent {
  cart = input<{ product: Product; quantity: number }[]>([]);
  total = input<number>(0);
  customers = input<PosCustomerOption[]>([]);
  selectedCustomerId = input<string>('');
  isProcessing = input<boolean>(false);

  customerIdChange = output<string>();
  paymentMethodChange = output<string>();
  quantityChange = output<{ productId: string; delta: number }>();
  checkout = output<void>();
  openDrawer = output<void>();
  readScale = output<void>();

  selectedPaymentMethod = 'PIX';

  readonly paymentMethods = [
    { id: 'PIX', name: 'PIX Instantâneo', icon: 'qr_code' },
    { id: 'DINHEIRO', name: 'Dinheiro', icon: 'attach_money' },
    { id: 'CARTAO_DEBITO', name: 'Cartão Débito', icon: 'credit_card' },
    { id: 'CARTAO_CREDITO', name: 'Cartão Crédito', icon: 'credit_score' }
  ];

  updateQuantity(productId: string, delta: number) {
    this.quantityChange.emit({ productId, delta });
  }

  onCustomerChange(event: Event) {
    this.customerIdChange.emit((event.target as HTMLSelectElement).value);
  }
}
