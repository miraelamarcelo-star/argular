import { Router } from 'express';
import { centralState, TableData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest } from '../middleware.js';

export const tablesRouter = Router();

tablesRouter.get('/tables', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const queryCompanyId = req.query['companyId'] as string | undefined;
  const companyId = req.user.role === 'hq_admin' ? (queryCompanyId || req.user.companyId) : req.user.companyId;
  const targetBranchId = (req.query['branchId'] as string | undefined) || req.user.branchId;

  const tables: TableData[] = [];
  for (const t of centralState.tables.values()) {
    if (t.companyId === companyId) {
      if (targetBranchId && t.branchId && t.branchId !== targetBranchId) {
        continue;
      }
      tables.push(t);
    }
  }

  // Sort by number / name
  tables.sort((a, b) => (a.number || 0) - (b.number || 0));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = parseInt(pageQuery as string, 10) || 1;
    const pageSize = parseInt(pageSizeQuery as string, 10) || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedTables = tables.slice(start, end);
    res.json({
      items: paginatedTables,
      total: tables.length,
      page,
      pageSize,
      totalPages: Math.ceil(tables.length / pageSize)
    });
  } else {
    res.json(tables);
  }
});
