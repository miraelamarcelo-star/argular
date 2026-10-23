import { Router } from 'express';
import { centralState, SaleData } from '../state.js';
import { requireTenantRole, requireHqAdmin, AuthenticatedRequest } from '../middleware.js';

export const salesRouter = Router();

// HQ Analytics Sales Endpoint (Ecosystem-wide metrics for HQ Control Plane)
salesRouter.get('/hq/analytics/sales', requireHqAdmin, (_req: AuthenticatedRequest, res) => {
  const sales: SaleData[] = Array.from(centralState.sales.values());
  sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(sales);
});

salesRouter.get('/sales', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const queryCompanyId = req.query['companyId'] as string | undefined;
  const companyId = req.user.role === 'hq_admin' ? (queryCompanyId || req.user.companyId) : req.user.companyId;
  const targetBranchId = (req.query['branchId'] as string | undefined) || req.user.branchId;

  const sales: SaleData[] = [];
  for (const s of centralState.sales.values()) {
    if (s.companyId === companyId) {
      if (targetBranchId && s.branchId && s.branchId !== targetBranchId) {
        continue;
      }
      sales.push(s);
    }
  }

  // Sort by date descending
  sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = parseInt(pageQuery as string, 10) || 1;
    const pageSize = parseInt(pageSizeQuery as string, 10) || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedSales = sales.slice(start, end);
    res.json({
      items: paginatedSales,
      total: sales.length,
      page,
      pageSize,
      totalPages: Math.ceil(sales.length / pageSize)
    });
  } else {
    res.json(sales);
  }
});
