import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { TableRepository } from '../domain/table.repository';
import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem } from '../domain/table.entity';
import { OsDatabaseNamespace, OsDatabaseTransaction } from '../../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsTableRepository implements TableRepository {
  private osSdk = inject(OsSdkService);
  private tablesNs: OsDatabaseNamespace;
  private salesNs: OsDatabaseNamespace;
  private financeNs: OsDatabaseNamespace;

  constructor() {
    // Vinculação canônica pelo SDK para isolamento de tenant automático
    const tablesApp = this.osSdk.bind('app_tables');
    this.tablesNs = tablesApp.storage;

    const posApp = this.osSdk.bind('app_pos');
    this.salesNs = posApp.storage;

    const financeApp = this.osSdk.bind('app_finance');
    this.financeNs = financeApp.storage;
  }

  async getTables(companyId: string): Promise<DiningTable[]> {
    const items = await this.tablesNs.query<DiningTable>();
    let tables = items.map((i) => i.value).filter((t) => t.companyId === companyId);
    
    // Auto-seed if empty
    if (tables.length === 0) {
      await this.seedTables(companyId);
      const newItems = await this.tablesNs.query<DiningTable>();
      tables = newItems.map((i) => i.value).filter((t) => t.companyId === companyId);
    }
    
    return tables;
  }
  
  private async seedTables(companyId: string) {
    const initialTables: DiningTable[] = [
      { id: 't1', companyId, number: 1, name: 'Mesa 01', capacity: 4, status: 'AVAILABLE' },
      { id: 't2', companyId, number: 2, name: 'Mesa 02', capacity: 4, status: 'AVAILABLE' },
      { id: 't3', companyId, number: 3, name: 'Mesa 03', capacity: 2, status: 'AVAILABLE' },
      { id: 't4', companyId, number: 4, name: 'Mesa 04', capacity: 6, status: 'AVAILABLE' },
      { id: 't5', companyId, number: 5, name: 'Mesa 05', capacity: 8, status: 'AVAILABLE' }
    ];
    for (const t of initialTables) {
      await this.tablesNs.put(`${companyId}_${t.id}`, t);
    }
  }

  async getKitchenOrders(companyId: string): Promise<TableKitchenOrder[]> {
    const tables = await this.getTables(companyId);
    const kitchenOrders: TableKitchenOrder[] = [];

    for (const table of tables) {
      if (table.currentOrder && table.currentOrder.items && table.currentOrder.items.length > 0) {
        const pendingItems = table.currentOrder.items.filter((i: TableOrderItem) => i.status === 'PENDING_KITCHEN' || i.status === 'PREPARING');
        if (pendingItems.length > 0) {
          kitchenOrders.push({
            tableNumber: table.number,
            tableName: table.name,
            order: {
              ...table.currentOrder,
              items: pendingItems
            }
          });
        }
      }
    }
    
    return kitchenOrders.sort((a, b) => new Date(a.order.openedAt).getTime() - new Date(b.order.openedAt).getTime());
  }

  async openTable(companyId: string, tableId: string, customerCount: number, waiterName: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table) throw new Error('Mesa não encontrada');
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    table.status = 'OCCUPIED';
    table.currentOrder = {
      id: `ord_${uuid}`,
      tableId,
      openedAt: new Date().toISOString(),
      customerCount,
      waiterName,
      items: [],
      subtotal: 0,
      total: 0
    };
    
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async addItemToOrder(
    companyId: string,
    tableId: string, 
    item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const newItem: TableOrderItem = {
      ...item,
      id: `item_${uuid}`,
      status: item.status || 'PENDING_KITCHEN',
      orderedAt: new Date().toISOString(),
      totalPrice: item.quantity * item.unitPrice
    };
    
    table.currentOrder.items.push(newItem);
    if (table.status === 'BILLING') {
      table.status = 'OCCUPIED';
    }
    
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async updateOrderItemStatus(
    companyId: string,
    tableId: string, 
    itemId: string, 
    status: OrderItemStatus
  ): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    const targetItem = table.currentOrder.items.find((i: TableOrderItem) => i.id === itemId);
    if (!targetItem) throw new Error('Item não encontrado na comanda');
    
    targetItem.status = status;
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async requestBill(companyId: string, tableId: string): Promise<DiningTable> {
    const dbKey = `${companyId}_${tableId}`;
    const table = await this.tablesNs.get<DiningTable>(dbKey);
    if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
    
    table.status = 'BILLING';
    await this.tablesNs.put(dbKey, table);
    return table;
  }

  async closeTable(companyId: string, tableId: string, paymentMethod: string): Promise<CloseTableResult> {
    const dbKey = `${companyId}_${tableId}`;
    
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const saleId = `sale_tbl_${uuid}`;
    let total = 0;
    let saleItems: { productId: string; quantity: number }[] = [];
    let tableName = '';
    const txId = `tx_table_${saleId}`;
    
    await this.tablesNs.transaction(async (tx: OsDatabaseTransaction) => {
      const table = await tx.get<DiningTable>(dbKey);
      if (!table || !table.currentOrder) throw new Error('Mesa não está aberta');
      
      tableName = table.name;
      saleItems = table.currentOrder.items.map((i: TableOrderItem) => ({
        productId: i.productId,
        quantity: i.quantity
      }));
      total = table.currentOrder.items.reduce((acc: number, i: TableOrderItem) => acc + (i.quantity * i.unitPrice), 0);
      
      // Criar Venda no app POS
      await tx.put(saleId, {
        id: saleId,
        companyId,
        total,
        timestamp: new Date().toISOString(),
        items: saleItems
      }, this.salesNs.namespace);
      
      // Criar transação Financeira
      await tx.put(txId, {
        id: txId,
        companyId,
        type: 'INFLOW',
        category: 'SALE',
        description: `Fechamento ${table.name} #${saleId.substring(0, 8)} (${table.currentOrder.customerCount} pessoas)`,
        amount: total,
        paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
        timestamp: new Date().toISOString(),
        operator: table.currentOrder.waiterName || 'Garçom',
        referenceId: saleId
      }, this.financeNs.namespace);
      
      // Liberar mesa
      table.status = 'AVAILABLE';
      table.currentOrder = undefined;
      await tx.put(dbKey, table);
    });

    const app = this.osSdk.bind('app_tables');
    await app.sync.queueOperation('sale.create', {
      id: saleId,
      companyId,
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      items: saleItems
    });

    await app.sync.queueOperation('finance.transaction', {
      id: txId,
      companyId,
      type: 'INFLOW',
      category: 'SALE',
      description: `Fechamento ${tableName} #${saleId.substring(0, 8)}`,
      amount: total,
      paymentMethod: paymentMethod === 'DINHEIRO' || paymentMethod === 'PIX' || paymentMethod === 'CARTAO_CREDITO' || paymentMethod === 'CARTAO_DEBITO' ? paymentMethod : 'DINHEIRO',
      timestamp: new Date().toISOString(),
      referenceId: saleId
    });

    await app.sync.queueOperation('table.close', { tableId });
    app.events.publish('table.closed', { tableId, saleId, total });
    app.logger.info(`Mesa #${tableId} finalizada com sucesso`, { saleId, total });
    
    return {
      success: true,
      saleId,
      total
    };
  }
}
