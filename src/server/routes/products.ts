import { Router } from 'express';
import { centralState, ProductData } from '../state.js';
import { requireTenantRole, AuthenticatedRequest } from '../middleware.js';

export const productsRouter = Router();

productsRouter.get('/products', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const queryCompanyId = req.query['companyId'] as string | undefined;
  const companyId = req.user.role === 'hq_admin' ? (queryCompanyId || req.user.companyId) : req.user.companyId;
  const targetBranchId = (req.query['branchId'] as string | undefined) || req.user.branchId;

  const prods: ProductData[] = [];
  for (const p of centralState.products.values()) {
    if (p.companyId === companyId) {
      if (targetBranchId && (p as unknown as { branchId?: string }).branchId && (p as unknown as { branchId?: string }).branchId !== targetBranchId) {
        continue;
      }
      prods.push(p);
    }
  }

  // Sort by name ascending
  prods.sort((a, b) => a.name.localeCompare(b.name));

  const pageQuery = req.query['page'];
  const pageSizeQuery = req.query['pageSize'];
  if (pageQuery !== undefined) {
    const page = parseInt(pageQuery as string, 10) || 1;
    const pageSize = parseInt(pageSizeQuery as string, 10) || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedProducts = prods.slice(start, end);
    res.json({
      items: paginatedProducts,
      total: prods.length,
      page,
      pageSize,
      totalPages: Math.ceil(prods.length / pageSize)
    });
  } else {
    res.json(prods);
  }
});
