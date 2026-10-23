import { Router } from 'express';
import { centralState, CustomerData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest } from '../middleware.js';

export const customersRouter = Router();

customersRouter.get('/customers', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const queryCompanyId = req.query['companyId'] as string | undefined;
  const companyId = req.user.role === 'hq_admin' ? (queryCompanyId || req.user.companyId) : req.user.companyId;
  const targetBranchId = (req.query['branchId'] as string | undefined) || req.user.branchId;

  const customers: CustomerData[] = [];
  for (const c of centralState.customers.values()) {
    if (c.companyId === companyId) {
      if (targetBranchId && (c as unknown as { branchId?: string }).branchId && (c as unknown as { branchId?: string }).branchId !== targetBranchId) {
        continue;
      }
      customers.push(c);
    }
  }

  // Sort by name ascending
  customers.sort((a, b) => a.name.localeCompare(b.name));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = parseInt(pageQuery as string, 10) || 1;
    const pageSize = parseInt(pageSizeQuery as string, 10) || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedCustomers = customers.slice(start, end);
    res.json({
      items: paginatedCustomers,
      total: customers.length,
      page,
      pageSize,
      totalPages: Math.ceil(customers.length / pageSize)
    });
  } else {
    res.json(customers);
  }
});
