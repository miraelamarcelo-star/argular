import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GetProductsUseCase, RegisterSaleUseCase } from '../application/pos.usecases';
import { GetCustomersUseCase, AddCustomerPointsUseCase } from '../../crm/application/crm.usecases';
import { Product, SaleItem } from '../domain/pos.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { IEventSubscription } from '../../../contracts/events/events.contract';
import { PosProductGridComponent } from './components/pos-product-grid.component';
import { PosCartComponent, PosCustomerOption } from './components/pos-cart.component';

export interface RemoteOrderNotification {
  orderId: string;
  customerName: string;
  total: number;
  items: { product: { name: string; price: number }; quantity: number }[];
  channel: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    PosProductGridComponent, 
    PosCartComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans">
      <!-- Header -->
      <header class="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <mat-icon class="text-[20px]">point_of_sale</mat-icon>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-900 leading-tight">Ponto de Venda (PDV)</h2>
            <p class="text-[11px] text-slate-500 font-medium">
              Terminal Operacional · {{ app.companyName }}
              @if (app.branchName) {
                · <span class="text-indigo-600 font-semibold">{{ app.branchName }}</span>
              }
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Incoming Remote Orders Counter Badge -->
          @if (incomingOrders().length > 0) {
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
              <mat-icon class="text-amber-600 text-[16px]">notifications_active</mat-icon>
              <span>{{ incomingOrders().length }} Pedido(s) Online</span>
            </div>
          }

          <!-- Conexão do Terminal -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            [class]="app.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
            <span class="w-2 h-2 rounded-full" [class]="app.isOnline ? 'bg-emerald-500' : 'bg-amber-500'"></span>
            {{ app.isOnline ? 'Terminal Online' : 'Modo Offline (Local)' }}
          </div>

          <div class="h-4 w-px bg-slate-200"></div>

          <div class="text-xs font-medium text-slate-500 flex items-center gap-1">
            <mat-icon class="text-slate-400 text-[16px]">lock_open</mat-icon>
            Caixa Aberto
          </div>
        </div>
      </header>

      <!-- Remote Order Incoming Alert Banner -->
      @if (incomingOrders().length > 0) {
        <div class="bg-indigo-900 text-white px-6 py-2.5 text-xs flex items-center justify-between animate-fade-in shadow-md">
          <div class="flex items-center gap-2 font-bold">
            <mat-icon class="text-amber-400 text-base animate-bounce">shopping_bag</mat-icon>
            <span>Novo Pedido Online Recebido: <strong>{{ incomingOrders()[0].customerName }}</strong> (R$ {{ incomingOrders()[0].total | number:'1.2-2' }})</span>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="acceptIncomingOrder(incomingOrders()[0])" class="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg cursor-pointer transition-colors">
              Carregar no Carrinho
            </button>
            <button (click)="dismissIncomingOrder(incomingOrders()[0].orderId)" class="text-indigo-200 hover:text-white px-2 py-1 cursor-pointer">
              Dispensar
            </button>
          </div>
        </div>
      }

      <!-- Alert Status -->
      @if (saleSuccessMessage()) {
        <div class="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 flex items-center justify-between animate-fade-in">
          <span class="flex items-center gap-1.5 font-semibold">
            <mat-icon class="text-sm text-emerald-600">check_circle</mat-icon>
            {{ saleSuccessMessage() }}
          </span>
          <button (click)="saleSuccessMessage.set('')" class="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer">FECHAR</button>
        </div>
      }
      @if (saleErrorMessage()) {
        <div class="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-xs text-rose-800 flex items-center justify-between animate-fade-in">
          <span class="flex items-center gap-1.5 font-semibold">
            <mat-icon class="text-sm text-rose-600">error</mat-icon>
            {{ saleErrorMessage() }}
          </span>
          <button (click)="saleErrorMessage.set('')" class="text-rose-600 hover:text-rose-800 font-bold cursor-pointer">FECHAR</button>
        </div>
      }

      <!-- Main Workspace -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Products Grid Subcomponent -->
        <main class="flex-1 overflow-hidden">
          <app-pos-product-grid
            [products]="products()"
            (productSelected)="addToCart($event)">
          </app-pos-product-grid>
        </main>

        <!-- Cart Sidebar Subcomponent -->
        <app-pos-cart
          [cart]="cart()"
          [total]="cartTotal()"
          [customers]="customers()"
          [selectedCustomerId]="selectedCustomerId"
          [isProcessing]="isProcessing()"
          (customerIdChange)="selectedCustomerId = $event"
          (paymentMethodChange)="selectedPaymentMethod = $event"
          (quantityChange)="handleQuantityChange($event)"
          (openDrawer)="handleOpenDrawer()"
          (readScale)="handleReadScale()"
          (checkout)="finishSale()">
        </app-pos-cart>
      </div>
    </div>
  `
})
export class PosComponent implements OnInit, OnDestroy {
  private getProductsUseCase = inject(GetProductsUseCase);
  private registerSaleUseCase = inject(RegisterSaleUseCase);
  private getCustomersUseCase = inject(GetCustomersUseCase);
  private addCustomerPointsUseCase = inject(AddCustomerPointsUseCase);
  private osSdk = inject(OsSdkService);

  // Contexto soberano fornecido pelo OS SDK
  app: OsContext = this.osSdk.bind('app_pos');

  products = signal<Product[]>([]);
  customers = signal<PosCustomerOption[]>([]);
  selectedCustomerId = '';
  selectedPaymentMethod = 'PIX';
  cart = signal<{ product: Product; quantity: number }[]>([]);
  isProcessing = signal(false);
  saleSuccessMessage = signal<string>('');
  saleErrorMessage = signal<string>('');
  incomingOrders = signal<RemoteOrderNotification[]>([]);

  private orderSubscription: IEventSubscription | null = null;

  async ngOnInit() {
    await this.loadProducts();
    await this.loadCustomers();

    // Inscrever no barramento de eventos do Kernel para receber pedidos remotos em tempo real
    this.orderSubscription = this.app.events.subscribe<RemoteOrderNotification>('marketplace.order_created', (evt) => {
      const order = evt.payload;
      this.incomingOrders.update(current => [order, ...current]);

      // Emite notificação nativa do sistema operacional
      this.app.notify(
        'Novo Pedido Online',
        `Pedido #${order.orderId.slice(-6)} de ${order.customerName} (R$ ${order.total.toFixed(2)})`,
        'info'
      );
    });
  }

  ngOnDestroy() {
    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }
  }

  acceptIncomingOrder(order: RemoteOrderNotification) {
    // Carregar itens do pedido online diretamente no carrinho do PDV
    for (const item of order.items) {
      const existingProduct = this.products().find(p => p.name.toLowerCase() === item.product.name.toLowerCase());
      if (existingProduct) {
        this.cart.update(curr => {
          const found = curr.find(c => c.product.id === existingProduct.id);
          if (found) {
            return curr.map(c => c.product.id === existingProduct.id ? { ...c, quantity: c.quantity + item.quantity } : c);
          }
          return [...curr, { product: existingProduct, quantity: item.quantity }];
        });
      } else {
        // Cria produto virtual para o item não cadastrado formalmente
        const virtualProd: Product = {
          id: `prod_virtual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          companyId: this.app.companyId,
          name: item.product.name,
          price: item.product.price,
          stock: 999,
          category: 'Online'
        };
        this.cart.update(curr => [...curr, { product: virtualProd, quantity: item.quantity }]);
      }
    }

    this.dismissIncomingOrder(order.orderId);
    this.app.notify('Pedido Carregado', `Itens do pedido de ${order.customerName} prontos para conferência e fechamento no PDV.`, 'success');
  }

  dismissIncomingOrder(orderId: string) {
    this.incomingOrders.update(curr => curr.filter(o => o.orderId !== orderId));
  }

  async loadProducts() {
    const loaded = await this.getProductsUseCase.execute(this.app.companyId);
    this.products.set(loaded);
  }

  async loadCustomers() {
    try {
      // Carrega clientes diretamente da fonte de verdade única do CRM!
      const raw = await this.getCustomersUseCase.execute(this.app.companyId);
      const mapped: PosCustomerOption[] = raw.map(c => ({
        id: c.id,
        name: c.name,
        points: c.points,
        tier: c.tier.toUpperCase()
      }));
      this.customers.set(mapped);
    } catch (e: unknown) {
      this.app.logger.warn('Erro ao carregar clientes do clube fidelidade do CRM', { error: String(e) });
    }
  }

  addToCart(product: Product) {
    this.cart.update(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        return current.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  handleQuantityChange(event: { productId: string; delta: number }) {
    this.cart.update(current => {
      return current
        .map(item => {
          if (item.product.id === event.productId) {
            const newQty = item.quantity + event.delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is { product: Product; quantity: number } => item !== null);
    });
  }

  cartTotal() {
    return this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }

  async handleOpenDrawer() {
    try {
      const ok = await this.app.hardware.triggerCashDrawer();
      if (ok) {
        this.app.notify('Gaveta de Dinheiro', 'Pulso elétrico RJ12 enviado. Gaveta aberta.', 'info');
      }
    } catch (err: unknown) {
      this.app.notify('Erro de Hardware', `Falha ao acionar gaveta: ${String(err)}`, 'warning');
    }
  }

  async handleReadScale() {
    try {
      const reading = await this.app.hardware.readScale();
      this.app.notify(
        'Balança Comercial',
        `Peso registrado: ${reading.weightKg.toFixed(3)} kg (Estabilizado: ${reading.isStable ? 'Sim' : 'Não'})`,
        'info'
      );
    } catch (err: unknown) {
      this.app.notify('Balança', `Falha na leitura: ${String(err)}`, 'warning');
    }
  }

  async finishSale() {
    if (this.cart().length === 0) return;
    
    this.isProcessing.set(true);
    this.saleSuccessMessage.set('');
    this.saleErrorMessage.set('');

    const cartSnapshot = [...this.cart()];
    const totalAmount = this.cartTotal();
    const customerId = this.selectedCustomerId;
    const paymentMethod = this.selectedPaymentMethod;

    try {
      const items: SaleItem[] = cartSnapshot.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity
      }));
      
      const createdSale = await this.registerSaleUseCase.execute({
        companyId: this.app.companyId,
        items,
        total: totalAmount,
        paymentMethod,
        status: 'COMPLETED'
      }, this.app.companyId);

      // Se pagamento em dinheiro, abre a gaveta automaticamente
      if (paymentMethod === 'DINHEIRO') {
        await this.app.hardware.triggerCashDrawer();
      }

      // Atualiza display de cliente no hardware
      await this.app.hardware.sendCustomerDisplay(
        `TOTAL: R$ ${totalAmount.toFixed(2)}`,
        'OBRIGADO! VOLTE SEMPRE'
      );

      // Atualização de pontos no clube fidelidade diretamente no CRM (Fonte Única de Verdade)
      let earnedPoints = 0;
      let selectedCustName = '';
      if (customerId) {
        earnedPoints = Math.floor(totalAmount / 10);
        try {
          const result = await this.addCustomerPointsUseCase.execute(customerId, earnedPoints);
          if (result.success && result.customer) {
            selectedCustName = result.customer.name;
            // Publish event to the OS EventBus so CRM and other components sync in real-time
            this.app.events.publish('crm.customer_updated', { customerId, earnedPoints, action: 'Compra no PDV' }, 'app_pos');
          }
        } catch (ptsErr) {
          this.app.logger.warn('Erro ao atualizar pontos de fidelidade no CRM', { error: String(ptsErr) });
        }
        // Recarrega lista de clientes atualizada do CRM
        await this.loadCustomers();
      }

      // Publish sale.completed event to the OS EventBus so Finance, Inventory, and WhatsApp apps sync in real-time
      this.app.events.publish('sale.completed', {
        saleId: createdSale.id,
        total: totalAmount,
        paymentMethod,
        customerId,
        customerName: selectedCustName || 'Cliente Consumidor',
        earnedPoints
      }, 'app_pos');
      
      // Auto-Print cupom de venda não fiscal na impressora do OS
      const itemsList = cartSnapshot.map(item => 
        `${item.product.name.padEnd(20)} ${item.quantity}x ${item.product.price.toFixed(2).padStart(8)}`
      ).join('\n');

      const loyaltyText = earnedPoints > 0 ? `
----------------------------------------
CLIENTE: ${selectedCustName.toUpperCase()}
PONTOS GANHOS: +${earnedPoints} pts` : '';

      const receiptContent = `
========================================
       ${this.app.companyName.toUpperCase()}
========================================
DATA: ${new Date().toLocaleString('pt-BR')}
RECIBO: #${createdSale.id.substring(0, 10).toUpperCase()}
PAGAMENTO: ${paymentMethod}
----------------------------------------
ITENS:
${itemsList}
----------------------------------------
TOTAL PAGO: R$ ${totalAmount.toFixed(2)}${loyaltyText}
========================================
    Agradecemos a sua preferência!
========================================
`;

      try {
        await this.app.print(`Recibo Venda - R$ ${totalAmount.toFixed(2)}`, receiptContent);
        this.app.notify('Venda Realizada', `Comprovante de venda emitido com sucesso (${paymentMethod}).`, 'success');
        this.saleSuccessMessage.set(`Venda concluída com sucesso! Recibo de venda enviado para a impressora.`);
      } catch (printErr: unknown) {
        const msg = printErr instanceof Error ? printErr.message : 'offline';
        this.saleSuccessMessage.set(`Venda registrada! (Aviso de impressão: ${msg})`);
      }

      // Reset cart and reload stock
      this.cart.set([]);
      this.selectedCustomerId = '';
      await this.loadProducts();
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.saleErrorMessage.set(`Falha ao registrar venda: ${msg}`);
      this.app.notify('Erro ao Finalizar', msg, 'error');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
