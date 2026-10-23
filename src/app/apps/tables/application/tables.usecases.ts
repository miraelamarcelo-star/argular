import { Injectable, inject } from '@angular/core';
import { OsTableRepository } from '../infrastructure/os-table.repository';
import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem } from '../domain/table.entity';

@Injectable({
  providedIn: 'root'
})
export class GetTablesUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string): Promise<DiningTable[]> {
    return this.repo.getTables(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class OpenTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, customerCount: number, waiterName: string): Promise<DiningTable> {
    return this.repo.openTable(companyId, tableId, customerCount, waiterName);
  }
}

@Injectable({
  providedIn: 'root'
})
export class AddItemToOrderUseCase {
  private repo = inject(OsTableRepository);
  execute(
    companyId: string,
    tableId: string, 
    item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }
  ): Promise<DiningTable> {
    return this.repo.addItemToOrder(companyId, tableId, item);
  }
}

@Injectable({
  providedIn: 'root'
})
export class UpdateOrderItemStatusUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, itemId: string, status: OrderItemStatus): Promise<DiningTable> {
    return this.repo.updateOrderItemStatus(companyId, tableId, itemId, status);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CloseTableUseCase {
  private repo = inject(OsTableRepository);
  execute(companyId: string, tableId: string, paymentMethod: string): Promise<CloseTableResult> {
    return this.repo.closeTable(companyId, tableId, paymentMethod);
  }
}

export interface KitchenItemView {
  tableNumber: number;
  tableName: string;
  tableId: string;
  item: TableOrderItem;
}

@Injectable({
  providedIn: 'root'
})
export class GetKitchenOrdersUseCase {
  private repo = inject(OsTableRepository);

  async execute(companyId: string): Promise<TableKitchenOrder[]> {
    return this.repo.getKitchenOrders(companyId);
  }
}
