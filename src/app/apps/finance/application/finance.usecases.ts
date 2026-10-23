import { Injectable, inject } from '@angular/core';
import { OsFinanceRepository } from '../infrastructure/os-finance.repository';
import { CashRegisterSummary, CashTransaction, CreateCashTransactionDto } from '../domain/finance.entity';

@Injectable({
  providedIn: 'root'
})
export class GetTransactionsUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string, limit?: number): Promise<CashTransaction[]> {
    return this.repo.getTransactions(companyId, limit);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CreateTransactionUseCase {
  private repo = inject(OsFinanceRepository);
  execute(transaction: CreateCashTransactionDto): Promise<CashTransaction> {
    return this.repo.createTransaction(transaction);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetCashSummaryUseCase {
  private repo = inject(OsFinanceRepository);
  execute(companyId: string): Promise<CashRegisterSummary> {
    return this.repo.getCashSummary(companyId);
  }
}
