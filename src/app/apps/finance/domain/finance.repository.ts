import { CashRegisterSummary, CashSummary, CashTransaction, CreateCashTransactionDto } from './finance.entity';

export type { CashSummary, CreateCashTransactionDto };

export interface FinanceRepository {
  getTransactions(companyId: string, limit?: number): Promise<CashTransaction[]>;
  createTransaction(transaction: CreateCashTransactionDto): Promise<CashTransaction>;
  getCashSummary(companyId: string): Promise<CashRegisterSummary>;
}
