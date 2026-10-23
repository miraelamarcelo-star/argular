import { Router } from 'express';
import { centralState, FinanceTransactionData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest } from '../middleware.js';

export const financeRouter = Router();

financeRouter.get('/finance/transactions', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const queryCompanyId = req.query['companyId'] as string | undefined;
  const companyId = req.user.role === 'hq_admin' ? (queryCompanyId || req.user.companyId) : req.user.companyId;
  const targetBranchId = (req.query['branchId'] as string | undefined) || req.user.branchId;

  const txs: FinanceTransactionData[] = [];
  for (const t of centralState.financeTransactions.values()) {
    if (t.companyId === companyId) {
      if (targetBranchId && t.branchId && t.branchId !== targetBranchId) {
        continue;
      }
      txs.push(t);
    }
  }

  // Sort by date descending
  txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = parseInt(pageQuery as string, 10) || 1;
    const pageSize = parseInt(pageSizeQuery as string, 10) || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedTxs = txs.slice(start, end);
    res.json({
      items: paginatedTxs,
      total: txs.length,
      page,
      pageSize,
      totalPages: Math.ceil(txs.length / pageSize)
    });
  } else {
    res.json(txs);
  }
});
