import { Component, ChangeDetectionStrategy, input, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { PublicProduct, PublicSpaceData } from './restaurant-template.component';
import { OsEventBusService } from '../../../core/events/event-bus.service';
import { Subscription, interval } from 'rxjs';

export interface CartItem {
  product: PublicProduct;
  quantity: number;
}

@Component({
  selector: 'app-public-space-cart-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Cart Toggle Button -->
    <button 
      (click)="isOpen.set(true)"
      [style.background-color]="space().themeColor || '#4f46e5'"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 text-white font-bold rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer">
      <div class="relative flex items-center justify-center">
        <mat-icon>shopping_bag</mat-icon>
        @if (totalItems() > 0) {
          <span class="absolute -top-2 -right-2 bg-amber-400 text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
            {{ totalItems() }}
          </span>
        }
      </div>
      <div class="text-left leading-tight hidden sm:block">
        <div class="text-[10px] uppercase font-bold opacity-80">Sacola de Pedidos</div>
        <div class="text-xs font-black">R$ {{ totalAmount() | number:'1.2-2' }}</div>
      </div>
    </button>

    <!-- Slide-over Drawer Backdrop -->
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 overflow-hidden animate-fade-in">
        <button 
          type="button" 
          aria-label="Fechar sacola" 
          class="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity w-full h-full border-none cursor-pointer" 
          (click)="isOpen.set(false)" 
          (keydown.escape)="isOpen.set(false)">
        </button>

        <div class="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
          <div class="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between pointer-events-auto">
            
            <!-- Drawer Header -->
            <div class="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <mat-icon class="text-[20px]">shopping_bag</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900 leading-tight">Sacola do Cliente</h3>
                  <p class="text-[11px] text-slate-500">{{ space().title }}</p>
                </div>
              </div>
              <button (click)="isOpen.set(false)" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Drawer Body -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              
              <!-- Success Notification Alert with Live Tracking Stepper -->
              @if (orderSuccess()) {
                <div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 animate-fade-in">
                  <div class="text-center space-y-2">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                      <mat-icon class="text-2xl">check_circle</mat-icon>
                    </div>
                    <h4 class="font-bold text-slate-900 text-base">Pedido Acompanhado em Tempo Real</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">
                      Seu pedido online do <strong>{{ space().title }}</strong> está integrado ao barramento de eventos do 3eatcru OS.
                    </p>
                    <div class="text-[11px] font-mono bg-slate-200/70 py-1 px-2.5 rounded text-slate-700 inline-block">
                      Código: {{ orderSuccessId().slice(-8).toUpperCase() }}
                    </div>
                  </div>

                  <!-- Stepper -->
                  <div class="relative py-2 px-1">
                    <!-- Progress Line background -->
                    <div class="absolute left-6 top-3 bottom-3 w-0.5 bg-slate-200"></div>
                    <!-- Active Progress Line overlay -->
                    <div class="absolute left-6 top-3 w-0.5 bg-indigo-600 transition-all duration-500"
                         [style.height.%]="getStepperProgressPercent()"></div>

                    <!-- Steps -->
                    <div class="space-y-5 relative">
                      <!-- Step 1: PENDING -->
                      <div class="flex items-start gap-4">
                        <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                             [class.border-indigo-600]="isStepActive('PENDING') || isStepDone('PENDING')"
                             [class.bg-indigo-600]="isStepDone('PENDING')">
                          @if (isStepDone('PENDING')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                        </div>
                        <div class="space-y-0.5">
                          <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('PENDING')" [class.text-slate-800]="!isStepActive('PENDING')">Pedido Recebido</h5>
                          <p class="text-[10px] text-slate-400">Aguardando confirmação na cozinha</p>
                        </div>
                      </div>

                      <!-- Step 2: PREPARING -->
                      <div class="flex items-start gap-4">
                        <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                             [class.border-indigo-600]="isStepActive('PREPARING') || isStepDone('PREPARING')"
                             [class.bg-indigo-600]="isStepDone('PREPARING')">
                          @if (isStepDone('PREPARING')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                        </div>
                        <div class="space-y-0.5">
                          <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('PREPARING')" [class.text-slate-800]="!isStepActive('PREPARING')">Em Preparação</h5>
                          <p class="text-[10px] text-slate-400">Nossos chefs estão preparando seu pedido</p>
                        </div>
                      </div>

                      <!-- Step 3: READY / DELIVERING -->
                      <div class="flex items-start gap-4">
                        <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                             [class.border-indigo-600]="isStepActive('READY') || isStepActive('DELIVERING') || isStepDone('READY')"
                             [class.bg-indigo-600]="isStepDone('READY')">
                          @if (isStepDone('READY')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                        </div>
                        <div class="space-y-0.5">
                          <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('READY') || isStepActive('DELIVERING')" [class.text-slate-800]="!(isStepActive('READY') || isStepActive('DELIVERING'))">Pronto para Retirada / Saiu para Entrega</h5>
                          <p class="text-[10px] text-slate-400">Pedido embalado e pronto para o consumo</p>
                        </div>
                      </div>

                      <!-- Step 4: COMPLETED -->
                      <div class="flex items-start gap-4">
                        <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white z-10 transition-colors"
                             [class.border-indigo-600]="isStepActive('COMPLETED')"
                             [class.bg-indigo-600]="isStepActive('COMPLETED')">
                          @if (isStepActive('COMPLETED')) { <div class="w-1.5 h-1.5 rounded-full bg-white"></div> }
                        </div>
                        <div class="space-y-0.5">
                          <h5 class="text-xs font-bold" [class.text-indigo-600]="isStepActive('COMPLETED')" [class.text-slate-800]="!isStepActive('COMPLETED')">Finalizado</h5>
                          <p class="text-[10px] text-slate-400">Entregue e concluído</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="pt-2 text-center">
                    <button (click)="resetOrder()" class="text-xs font-bold text-slate-600 hover:text-indigo-600 underline cursor-pointer transition-colors">
                      Fazer nova compra
                    </button>
                  </div>
                </div>
              } @else {

                <!-- Cart Items List -->
                @if (items().length === 0) {
                  <div class="py-12 text-center space-y-3">
                    <mat-icon class="text-slate-300 text-5xl w-auto h-auto">remove_shopping_cart</mat-icon>
                    <p class="text-sm text-slate-500 font-medium">Sua sacola está vazia.</p>
                    <p class="text-xs text-slate-400 max-w-xs mx-auto">Selecione produtos no cardápio ou vitrine ao lado para montar seu pedido online.</p>
                  </div>
                } @else {
                  <div class="space-y-3">
                    <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Itens Selecionados</div>
                    @for (item of items(); track item.product.name) {
                      <div class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <div class="space-y-0.5 max-w-[180px]">
                          <h5 class="text-xs font-bold text-slate-900 truncate">{{ item.product.name }}</h5>
                          <span class="text-[11px] text-slate-500 font-mono">R$ {{ item.product.price | number:'1.2-2' }} un</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <!-- Quantity Controls -->
                          <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                            <button (click)="decreaseQty(item)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer">-</button>
                            <span class="w-6 text-center text-xs font-bold text-slate-900 font-mono">{{ item.quantity }}</span>
                            <button (click)="increaseQty(item)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer">+</button>
                          </div>
                          <span class="text-xs font-black text-slate-900 font-mono w-16 text-right">
                            R$ {{ (item.product.price * item.quantity) | number:'1.2-2' }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Customer Checkout Details Form -->
                  <div class="pt-4 border-t border-slate-100 space-y-3">
                    <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Dados de Entrega / Retirada</div>
                    <div>
                      <label for="cart-customer-name" class="block text-[11px] font-bold text-slate-700 mb-1">Seu Nome Completo *</label>
                      <input 
                        id="cart-customer-name"
                        type="text" 
                        [value]="customerName()" 
                        (input)="customerName.set($any($event.target).value)" 
                        placeholder="Ex: Maria da Silva" 
                        class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label for="cart-customer-phone" class="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                        <input 
                          id="cart-customer-phone"
                          type="text" 
                          [value]="customerPhone()" 
                          (input)="customerPhone.set($any($event.target).value)" 
                          placeholder="(11) 98765-4321" 
                          class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                      </div>
                      <div>
                        <label for="cart-payment-method" class="block text-[11px] font-bold text-slate-700 mb-1">Forma de Pagamento</label>
                        <select 
                          id="cart-payment-method"
                          [value]="paymentMethod()" 
                          (change)="paymentMethod.set($any($event.target).value)" 
                          class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                          <option value="PIX">PIX Online</option>
                          <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                          <option value="CARTAO_DEBITO">Cartão de Débito</option>
                          <option value="DINHEIRO">Dinheiro na Entrega</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label for="cart-customer-address" class="block text-[11px] font-bold text-slate-700 mb-1">Endereço de Entrega (ou Retirada no Balcão)</label>
                      <input 
                        id="cart-customer-address"
                        type="text" 
                        [value]="customerAddress()" 
                        (input)="customerAddress.set($any($event.target).value)" 
                        placeholder="Rua, Número, Bairro ou 'Retirar no local'" 
                        class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none bg-white">
                    </div>
                  </div>
                }

              }

            </div>

            <!-- Drawer Footer -->
            @if (!orderSuccess() && items().length > 0) {
              <div class="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-bold text-slate-600">Total do Pedido:</span>
                  <span class="font-black text-slate-900 text-lg font-mono">
                    R$ {{ totalAmount() | number:'1.2-2' }}
                  </span>
                </div>

                @if (errorMessage()) {
                  <div class="text-[11px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg">
                    {{ errorMessage() }}
                  </div>
                }

                <button 
                  (click)="submitOrder()"
                  [disabled]="isSubmitting() || items().length === 0"
                  [style.background-color]="space().themeColor || '#4f46e5'"
                  class="w-full py-3.5 px-4 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all">
                  @if (isSubmitting()) {
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Transmitindo Pedido...</span>
                  } @else {
                    <mat-icon class="text-[18px]">send</mat-icon>
                    <span>Confirmar & Transmitir Pedido</span>
                  }
                </button>
              </div>
            }

          </div>
        </div>
      </div>
    }
  `
})
export class PublicSpaceCartDrawerComponent implements OnDestroy {
  private http = inject(HttpClient);
  private eventBus = inject(OsEventBusService);

  space = input.required<PublicSpaceData>();
  
  // State
  isOpen = signal<boolean>(false);
  items = signal<CartItem[]>([]);
  customerName = signal<string>('');
  customerPhone = signal<string>('');
  customerAddress = signal<string>('');
  paymentMethod = signal<string>('PIX');
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  orderSuccess = signal<boolean>(false);
  orderSuccessId = signal<string>('');
  orderStatus = signal<string>('PENDING');

  private pollSubscription?: Subscription;

  ngOnDestroy() {
    this.stopPolling();
  }

  getStepperProgressPercent(): number {
    const s = this.orderStatus();
    switch (s) {
      case 'PENDING': return 0;
      case 'PREPARING': return 33;
      case 'READY':
      case 'DELIVERING': return 66;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  }

  isStepActive(step: string): boolean {
    const current = this.orderStatus();
    if (step === 'PENDING' && current === 'PENDING') return true;
    if (step === 'PREPARING' && current === 'PREPARING') return true;
    if (step === 'READY' && (current === 'READY' || current === 'DELIVERING')) return true;
    if (step === 'COMPLETED' && current === 'COMPLETED') return true;
    return false;
  }

  isStepDone(step: string): boolean {
    const current = this.orderStatus();
    const sequence = ['PENDING', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'];
    const currentIndex = sequence.indexOf(current === 'DELIVERING' ? 'READY' : current);
    const stepIndex = sequence.indexOf(step);
    return currentIndex > stepIndex;
  }

  private startPolling(orderId: string) {
    this.stopPolling();
    this.orderStatus.set('PENDING');
    
    this.pollSubscription = interval(4000).subscribe(() => {
      this.http.get<{ success: boolean; order?: { status: string } }>(`/public-space/orders/${orderId}`).subscribe({
        next: (res) => {
          if (res?.order?.status) {
            this.orderStatus.set(res.order.status);
            if (res.order.status === 'COMPLETED') {
              this.stopPolling();
            }
          }
        },
        error: (err) => {
          console.warn('Erro ao consultar status do pedido online:', err);
        }
      });
    });
  }

  private stopPolling() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = undefined;
    }
  }

  totalItems = computed(() => {
    return this.items().reduce((acc, curr) => acc + curr.quantity, 0);
  });

  totalAmount = computed(() => {
    return this.items().reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);
  });

  addToCart(product: PublicProduct) {
    this.items.update(curr => {
      const existing = curr.find(i => i.product.name === product.name);
      if (existing) {
        return curr.map(i => i.product.name === product.name ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...curr, { product, quantity: 1 }];
      }
    });
    this.isOpen.set(true);
  }

  increaseQty(item: CartItem) {
    this.items.update(curr => curr.map(i => i.product.name === item.product.name ? { ...i, quantity: i.quantity + 1 } : i));
  }

  decreaseQty(item: CartItem) {
    this.items.update(curr => {
      const found = curr.find(i => i.product.name === item.product.name);
      if (found && found.quantity > 1) {
        return curr.map(i => i.product.name === item.product.name ? { ...i, quantity: i.quantity - 1 } : i);
      } else {
        return curr.filter(i => i.product.name !== item.product.name);
      }
    });
  }

  async submitOrder() {
    if (!this.customerName().trim()) {
      this.errorMessage.set('Por favor, informe o seu nome para identificação.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const payload = {
      companyId: this.space().companyId,
      customerName: this.customerName(),
      customerPhone: this.customerPhone(),
      customerAddress: this.customerAddress(),
      paymentMethod: this.paymentMethod(),
      items: this.items().map(i => ({
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      }))
    };

    this.http.post<{ success: boolean; orderId: string; order: unknown }>('/api/v1/public-space/orders', payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.orderSuccess.set(true);
        this.orderSuccessId.set(res.orderId);

        this.startPolling(res.orderId);

        // Disparar evento soberano no barramento de eventos do Kernel
        this.eventBus.publish('marketplace.order_created', {
          orderId: res.orderId,
          companyId: this.space().companyId,
          customerName: this.customerName(),
          total: this.totalAmount(),
          items: this.items(),
          channel: 'PUBLIC_SPACE'
         }, 'app_public_space');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.error || 'Erro de comunicação ao enviar pedido. Tente novamente.');
      }
    });
  }

  resetOrder() {
    this.stopPolling();
    this.items.set([]);
    this.orderSuccess.set(false);
    this.orderSuccessId.set('');
    this.orderStatus.set('PENDING');
    this.errorMessage.set(null);
  }
}
