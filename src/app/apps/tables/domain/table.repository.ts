import { CloseTableResult, DiningTable, OrderItemStatus, TableKitchenOrder, TableOrderItem } from './table.entity';

export interface TableRepository {
  getTables(companyId: string): Promise<DiningTable[]>;
  getKitchenOrders(companyId: string): Promise<TableKitchenOrder[]>;
  openTable(tableId: string, companyId: string, customerCount: number, waiterName: string): Promise<DiningTable>;
  addItemToOrder(tableId: string, companyId: string, item: Omit<TableOrderItem, 'id' | 'orderedAt' | 'totalPrice' | 'status'> & { status?: OrderItemStatus }): Promise<DiningTable>;
  updateOrderItemStatus(tableId: string, companyId: string, itemId: string, status: OrderItemStatus): Promise<DiningTable>;
  requestBill(tableId: string, companyId: string): Promise<DiningTable>;
  closeTable(tableId: string, companyId: string, paymentMethod: string): Promise<CloseTableResult>;
}
