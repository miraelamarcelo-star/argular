/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { 
  GetTablesUseCase, 
  OpenTableUseCase, 
  AddItemToOrderUseCase, 
  UpdateOrderItemStatusUseCase, 
  CloseTableUseCase, 
  GetKitchenOrdersUseCase 
} from '../application/tables.usecases';
import { DiningTable, TableOrder, OrderItemStatus } from '../domain/table.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { TableCardComponent } from './components/table-card.component';
import { KdsDisplayComponent, TableKitchenOrder } from './components/kds-display.component';
import { TableOpenModalComponent } from './components/table-open-modal.component';
import { TableOrderModalComponent } from './components/table-order-modal.component';
import { TableCheckoutModalComponent } from './components/table-checkout-modal.component';

export interface PublicOrderData {
  id: string;
  companyId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod?: string;
  total: number;
  status: string;
  createdAt: string;
  items: {
    name: string;
    unitPrice?: number;
    price?: number;
    quantity: number;
    notes?: string;
  }[];
}

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    TableCardComponent,
    KdsDisplayComponent,
    TableOpenModalComponent,
    TableOrderModalComponent,
    TableCheckoutModalComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans text-slate-800">
      
      <!-- Top Navigation & Header -->
      <header class="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <mat-icon class="text-xl">table_restaurant</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
              Mesas, Comandas & Cozinha (KDS)
              <span class="text-[10px] font-mono uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">Food Service OS</span>
            </h2>
            <p class="text-xs text-slate-500">Gestão de salão, comandas eletrônicas, fila de produção KDS e pré-conta com emissão térmica.</p>
          </div>
        </div>

        <!-- Mode Toggle & Global Stats -->
        <div class="flex items-center gap-3">
          <div class="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
            <button 
              (click)="viewMode.set('SALON')"
              [class.bg-white]="viewMode() === 'SALON'"
              [class.shadow-sm]="viewMode() === 'SALON'"
              [class.text-indigo-700]="viewMode() === 'SALON'"
              class="px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5">
              <mat-icon class="text-xs">grid_view</mat-icon> Mapa de Salão
            </button>
            <button 
              (click)="viewMode.set('KDS')"
              [class.bg-white]="viewMode() === 'KDS'"
              [class.shadow-sm]="viewMode() === 'KDS'"
              [class.text-indigo-700]="viewMode() === 'KDS'"
              class="px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5">
              <mat-icon class="text-xs">soup_kitchen</mat-icon> Cozinha (KDS)
              @if (pendingKitchenCount() > 0) {
                <span class="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold font-mono animate-pulse">
                  {{ pendingKitchenCount() }}
                </span>
              }
            </button>
          </div>

          <button 
            (click)="loadData()" 
            class="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            title="Atualizar dados">
            <mat-icon class="text-sm">refresh</mat-icon>
          </button>
        </div>
      </header>

      <!-- Feedback Toast Banner -->
      @if (feedbackMessage()) {
        <div class="bg-indigo-600 text-white text-xs px-6 py-2 flex items-center justify-between shadow-inner animate-fade-in">
          <span class="font-medium flex items-center gap-1.5">
            <mat-icon class="text-xs">info</mat-icon> {{ feedbackMessage() }}
          </span>
          <button (click)="feedbackMessage.set('')" class="text-indigo-200 hover:text-white">
            <mat-icon class="text-xs">close</mat-icon>
          </button>
        </div>
      }

      <!-- SALON VIEW: MAPA DE MESAS -->
      @if (viewMode() === 'SALON') {
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          
          <!-- Salon KPIs Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Capacidade Total</span>
                <div class="text-lg font-bold font-mono text-slate-800">{{ tables().length }} mesas</div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <mat-icon class="text-lg">room_preferences</mat-icon>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-[11px] text-emerald-600 font-bold uppercase tracking-wider">Livres</span>
                <div class="text-lg font-bold font-mono text-emerald-700">{{ availableTablesCount() }}</div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <mat-icon class="text-lg">check_circle</mat-icon>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-[11px] text-blue-600 font-bold uppercase tracking-wider">Ocupadas / Consumo</span>
                <div class="text-lg font-bold font-mono text-blue-700">{{ occupiedTablesCount() }}</div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <mat-icon class="text-lg">restaurant</mat-icon>
              </div>
            </div>

            <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-[11px] text-indigo-600 font-bold uppercase tracking-wider">Total em Salão</span>
                <div class="text-lg font-bold font-mono text-indigo-700">R$ {{ totalSalonRevenue() | number:'1.2-2' }}</div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <mat-icon class="text-lg">payments</mat-icon>
              </div>
            </div>
          </div>

          <!-- Filter Pills -->
          <div class="flex items-center gap-2">
            <button 
              (click)="tableFilter.set('ALL')"
              [class.bg-slate-900]="tableFilter() === 'ALL'"
              [class.text-white]="tableFilter() === 'ALL'"
              [class.bg-white]="tableFilter() !== 'ALL'"
              [class.text-slate-600]="tableFilter() !== 'ALL'"
              class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 transition-colors">
              Todas ({{ tables().length }})
            </button>
            <button 
              (click)="tableFilter.set('AVAILABLE')"
              [class.bg-emerald-600]="tableFilter() === 'AVAILABLE'"
              [class.text-white]="tableFilter() === 'AVAILABLE'"
              [class.bg-white]="tableFilter() !== 'AVAILABLE'"
              [class.text-emerald-700]="tableFilter() !== 'AVAILABLE'"
              class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 transition-colors">
              Livres ({{ availableTablesCount() }})
            </button>
            <button 
              (click)="tableFilter.set('OCCUPIED')"
              [class.bg-blue-600]="tableFilter() === 'OCCUPIED'"
              [class.text-white]="tableFilter() === 'OCCUPIED'"
              [class.bg-white]="tableFilter() !== 'OCCUPIED'"
              [class.text-blue-700]="tableFilter() !== 'OCCUPIED'"
              class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 transition-colors">
              Ocupadas ({{ occupiedTablesCount() }})
            </button>
            <button 
              (click)="tableFilter.set('BILLING')"
              [class.bg-amber-600]="tableFilter() === 'BILLING'"
              [class.text-white]="tableFilter() === 'BILLING'"
              [class.bg-white]="tableFilter() !== 'BILLING'"
              [class.text-amber-700]="tableFilter() !== 'BILLING'"
              class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 transition-colors">
              Em Fechamento ({{ billingTablesCount() }})
            </button>
          </div>

          <!-- Tables Grid (Modular TableCardComponent) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            @for (table of filteredTables(); track table.id) {
              <app-table-card
                [table]="table"
                (openTableModal)="openTableModal($event)"
                (viewOrder)="selectOrderDetails($event)"
                (checkoutTable)="openCloseTableModal($event)">
              </app-table-card>
            }
          </div>

        </div>
      }

      <!-- KDS VIEW: KITCHEN DISPLAY SYSTEM (Modular KdsDisplayComponent) -->
      @if (viewMode() === 'KDS') {
        <app-kds-display
          [kitchenOrders]="kitchenOrders()"
          [onlineOrders]="onlineOrders()"
          (updateItemStatus)="updateItemStatus($event.tableId, $event.itemId, $event.status)"
          (updateOnlineStatus)="updateOnlineOrderStatus($event.orderId, $event.status)"
          (printTicket)="printKitchenTicket($event.tableNumber, $event.tableName, $event.order)"
          (printOnlineTicket)="printOnlineDeliveryTicket($event)">
        </app-kds-display>
      }

      <!-- MODAL: ABRIR MESA (Modular TableOpenModalComponent) -->
      @if (selectedTableForOpen(); as openTable) {
        <app-table-open-modal
          [table]="openTable"
          (closeModal)="selectedTableForOpen.set(null)"
          (confirm)="confirmOpenTable($event.customerCount, $event.waiterName)">
        </app-table-open-modal>
      }

      <!-- MODAL: DETALHES DA COMANDA / ADICIONAR ITENS (Modular TableOrderModalComponent) -->
      @if (selectedTableForOrder(); as orderTable) {
        <app-table-order-modal
          [table]="orderTable"
          (closeModal)="selectedTableForOrder.set(null)"
          (addItem)="addItemToCurrentTable($event.name, $event.quantity, $event.price, $event.notes)"
          (checkout)="openCloseTableModal($event)"
          (printPreBill)="printPreBill($event)">
        </app-table-order-modal>
      }

      <!-- MODAL: FECHAR CONTA & RECEBER (Modular TableCheckoutModalComponent) -->
      @if (selectedTableForClose(); as closeTable) {
        <app-table-checkout-modal
          [table]="closeTable"
          (closeModal)="selectedTableForClose.set(null)"
          (confirm)="confirmCloseTable($event)">
        </app-table-checkout-modal>
      }

    </div>
  `
})
export class TablesComponent implements OnInit, OnDestroy {
  private getTablesUseCase = inject(GetTablesUseCase);
  private openTableUseCase = inject(OpenTableUseCase);
  private addItemToOrderUseCase = inject(AddItemToOrderUseCase);
  private updateOrderItemStatusUseCase = inject(UpdateOrderItemStatusUseCase);
  private closeTableUseCase = inject(CloseTableUseCase);
  private getKitchenOrdersUseCase = inject(GetKitchenOrdersUseCase);
  private osSdk = inject(OsSdkService);
  os: OsContext = this.osSdk.bind('app_tables');

  private osSubs: { unsubscribe: () => void }[] = [];

  tables = signal<DiningTable[]>([]);
  kitchenOrders = signal<TableKitchenOrder[]>([]);
  onlineOrders = signal<PublicOrderData[]>([]);
  viewMode = signal<'SALON' | 'KDS'>('SALON');
  tableFilter = signal<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'BILLING'>('ALL');
  feedbackMessage = signal<string>('');

  // Modals state
  selectedTableForOpen = signal<DiningTable | null>(null);
  selectedTableForOrder = signal<DiningTable | null>(null);
  selectedTableForClose = signal<DiningTable | null>(null);

  // Derived counts
  availableTablesCount = computed(() => this.tables().filter(t => t.status === 'AVAILABLE').length);
  occupiedTablesCount = computed(() => this.tables().filter(t => t.status === 'OCCUPIED').length);
  billingTablesCount = computed(() => this.tables().filter(t => t.status === 'BILLING').length);
  
  totalSalonRevenue = computed(() => {
    return this.tables().reduce((acc, t) => acc + (t.currentOrder?.total || 0), 0);
  });

  pendingKitchenCount = computed(() => {
    let count = 0;
    for (const ko of this.kitchenOrders()) {
      count += ko.order.items.filter(i => i.status === 'PENDING_KITCHEN').length;
    }
    // Adiciona também pedidos online pendentes e em preparo
    count += this.onlineOrders().filter(o => o.status === 'PENDING' || o.status === 'RECEIVED' || o.status === 'PREPARING').length;
    return count;
  });

  filteredTables = computed(() => {
    const f = this.tableFilter();
    if (f === 'ALL') return this.tables();
    return this.tables().filter(t => t.status === f);
  });

  ngOnInit() {
    this.loadData();

    this.osSubs.push(
      this.os.events.subscribe('marketplace.order_created', (evt: any) => {
        this.loadData();
        const payload = evt?.payload;
        const info = payload?.customerName ? ` de ${payload.customerName}` : '';
        const total = payload?.total ? ` (R$ ${payload.total.toFixed(2)})` : '';
        this.feedbackMessage.set(`Novo pedido online recebido pelo Marketplace${info}!`);
        
        // Emite uma notificação nativa para a Central de Notificações do 3eatcru OS
        this.os.notify(
          'Novo Pedido Online',
          `Pedido recebido${info}${total}. Enviado automaticamente para o KDS.`,
          'success'
        );
      })
    );

    this.osSubs.push(
      this.os.events.subscribe('marketplace.order_status_updated', () => {
        this.loadData();
      })
    );
  }

  ngOnDestroy() {
    this.osSubs.forEach(s => s.unsubscribe());
  }

  async loadData() {
    try {
      const companyId = this.os.companyId;
      const [tableList, kOrders] = await Promise.all([
        this.getTablesUseCase.execute(companyId),
        this.getKitchenOrdersUseCase.execute(companyId)
      ]);
      this.tables.set(tableList);
      this.kitchenOrders.set(kOrders);

      try {
        const res = await this.os.network.http.get<PublicOrderData[] | { orders: PublicOrderData[] }>(`/companies/${companyId}/orders`);
        if (Array.isArray(res)) {
          this.onlineOrders.set(res);
        } else if (res && Array.isArray((res as any).orders)) {
          this.onlineOrders.set((res as any).orders);
        }
      } catch (err) {
        console.warn('Erro ao carregar pedidos online:', err);
      }
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    }
  }

  openTableModal(table: DiningTable) {
    this.selectedTableForOpen.set(table);
  }

  async confirmOpenTable(customerCount: number, waiterName: string) {
    const table = this.selectedTableForOpen();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      await this.openTableUseCase.execute(companyId, table.id, customerCount, waiterName);
      this.selectedTableForOpen.set(null);
      this.feedbackMessage.set(`${table.name} aberta com sucesso!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao abrir mesa:', err);
      this.feedbackMessage.set('Falha ao abrir mesa.');
    }
  }

  selectOrderDetails(table: DiningTable) {
    this.selectedTableForOrder.set(table);
  }

  async addItemToCurrentTable(name: string, quantity: number, price: number, notes?: string) {
    const table = this.selectedTableForOrder();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const updatedTable = await this.addItemToOrderUseCase.execute(companyId, table.id, {
        productId: `prod_${Date.now()}`,
        name,
        quantity,
        unitPrice: price,
        notes
      });

      this.selectedTableForOrder.set(updatedTable);
      this.feedbackMessage.set(`"${name}" adicionado à comanda!`);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao adicionar item:', err);
      this.feedbackMessage.set('Falha ao adicionar item à mesa.');
    }
  }

  async updateItemStatus(tableId: string, itemId: string, status: OrderItemStatus) {
    try {
      const companyId = this.os.companyId;
      await this.updateOrderItemStatusUseCase.execute(companyId, tableId, itemId, status);
      await this.loadData();
    } catch (err) {
      console.error('Erro ao atualizar status do item:', err);
    }
  }

  async updateOnlineOrderStatus(orderId: string, status: string) {
    try {
      await this.os.network.http.patch<{ success: boolean }>(`/public-space/orders/${orderId}/status`, { status });
      this.feedbackMessage.set(`Pedido #${orderId.slice(-6)} atualizado para ${status}!`);
      this.os.events.publish('marketplace.order_status_updated', { orderId, status }, 'app_tables');
      this.loadData();
    } catch (err) {
      console.error('Erro ao atualizar status do pedido online:', err);
      this.feedbackMessage.set('Falha ao atualizar pedido online.');
    }
  }

  openCloseTableModal(table: DiningTable) {
    this.selectedTableForOrder.set(null);
    this.selectedTableForClose.set(table);
  }

  async confirmCloseTable(paymentMethod: string) {
    const table = this.selectedTableForClose();
    if (!table) return;

    try {
      const companyId = this.os.companyId;
      const res = await this.closeTableUseCase.execute(companyId, table.id, paymentMethod);
      
      this.selectedTableForClose.set(null);
      this.feedbackMessage.set(`${table.name} encerrada! Venda de R$ ${res.total.toFixed(2)} consolidada no caixa.`);
      
      // Auto print fiscal closing receipt
      this.printFiscalBill(table, res.total, res.saleId, paymentMethod);

      await this.loadData();
    } catch (err) {
      console.error('Erro ao encerrar mesa:', err);
      this.feedbackMessage.set('Falha ao encerrar mesa.');
    }
  }

  async printKitchenTicket(tableNumber: number, tableName: string, order: TableOrder) {
    const dateStr = new Date().toLocaleString('pt-BR');
    const itemsText = order.items
      .map(i => `[ ] ${i.quantity}x ${i.name.toUpperCase()}\n    STATUS: ${i.status}${i.notes ? `\n    OBS: ${i.notes}` : ''}`)
      .join('\n----------------------------------------\n');

    const formattedContent = `
========================================
       3EATCRU OS - TICKET COZINHA
           COMANDA DE PRODUÇÃO
========================================
MESA #${tableNumber} - ${tableName.toUpperCase()}
ATENDENTE: ${order.waiterName}
HORA DO PEDIDO: ${dateStr}
----------------------------------------
ITENS PARA PREPARO:
----------------------------------------
${itemsText}
========================================
TOTAL DE ITENS: ${order.items.length}
    `;

    try {
      await this.os.print(`Cozinha Mesa #${tableNumber}`, formattedContent);
      this.feedbackMessage.set(`Ticket de Cozinha da Mesa #${tableNumber} impresso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  async printPreBill(table: DiningTable) {
    if (!table.currentOrder) return;
    const order = table.currentOrder;
    const dateStr = new Date().toLocaleString('pt-BR');
    const itemsText = order.items
      .map(i => `${i.quantity}x ${i.name.padEnd(20, ' ')} R$ ${(i.quantity * i.unitPrice).toFixed(2).padStart(8, ' ')}`)
      .join('\n');

    const perPerson = order.perPersonTotal ?? (order.customerCount > 0 ? (order.total / order.customerCount) : order.total);
    const formattedContent = `
========================================
       3EATCRU OS - PRÉ-CONTA
      CONFERÊNCIA DE MESA / SALÃO
========================================
MESA: #${table.number} - ${table.name.toUpperCase()}
ATENDENTE: ${order.waiterName}
CLIENTES: ${order.customerCount} pessoas
DATA/HORA: ${dateStr}
----------------------------------------
ITENS CONSUMIDOS:
${itemsText}
----------------------------------------
SUBTOTAL:                R$ ${order.total.toFixed(2)}
VALOR POR PESSOA (${order.customerCount}x): R$ ${perPerson.toFixed(2)}
========================================
ESTE DOCUMENTO NÃO É DOCUMENTO FISCAL
AGRADECEMOS A PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Pré-Conta Mesa #${table.number}`, formattedContent);
      this.feedbackMessage.set(`Pré-Conta da Mesa #${table.number} emitida na impressora térmica!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  async printOnlineDeliveryTicket(order: PublicOrderData) {
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('pt-BR');
    const itemsText = (order.items || [])
      .map((i: { name: string; unitPrice?: number; price?: number; quantity: number; notes?: string }) => {
        const itemPrice = Number(i.unitPrice ?? i.price ?? 0);
        return `[ ] ${i.quantity}x ${i.name.toUpperCase()}\n    R$ ${(i.quantity * itemPrice).toFixed(2)} ${i.notes ? `(OBS: ${i.notes})` : ''}`;
      })
      .join('\n----------------------------------------\n');

    const formattedContent = `
========================================
    3EATCRU OS - DELIVERY / MARKETPLACE
           TICKET DE EXPEDIÇÃO
========================================
PEDIDO: #${order.id.slice(-8).toUpperCase()}
CLIENTE: ${order.customerName.toUpperCase()}
WHATSAPP: ${order.customerPhone || 'N/A'}
ENDEREÇO: ${order.customerAddress || 'Retirada no Balcão'}
HORA DO PEDIDO: ${dateStr}
PAGAMENTO: ${order.paymentMethod || 'PIX'}
----------------------------------------
ITENS DO PEDIDO:
----------------------------------------
${itemsText}
----------------------------------------
TOTAL A PAGAR:           R$ ${Number(order.total || 0).toFixed(2)}
========================================
OBRIGADO PELA PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Delivery #${order.id.slice(-6)}`, formattedContent);
      this.feedbackMessage.set(`Ticket de Delivery #${order.id.slice(-6)} impresso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na impressora';
      this.feedbackMessage.set(`Atenção: ${msg}.`);
    }
  }

  private async printFiscalBill(table: DiningTable, total: number, saleId: string, paymentMethod: string) {
    const companyName = this.os.companyName;
    const dateStr = new Date().toLocaleString('pt-BR');

    const formattedContent = `
========================================
       3EATCRU OS - CUPOM FISCAL
========================================
EMPRESA: ${companyName.toUpperCase()}
MESA: #${table.number} - ${table.name}
VENDA ID: #${saleId.substring(0, 10)}
DATA/HORA: ${dateStr}
PAGAMENTO: ${paymentMethod}
----------------------------------------
VALOR TOTAL PAGO:        R$ ${total.toFixed(2)}
========================================
MESA LIBERADA COM SUCESSO.
OBRIGADO PELA PREFERÊNCIA!
    `;

    try {
      await this.os.print(`Cupom Fiscal Mesa #${table.number}`, formattedContent);
    } catch (err) {
      console.error('Falha ao imprimir cupom fiscal:', err);
    }
  }
}
