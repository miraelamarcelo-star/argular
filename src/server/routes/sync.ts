import { Router } from 'express';
import { z } from 'zod';
import { centralState, centralDatabase, saveIdempotencyLog, saveCentralState, SaleData, CustomerData, TableData, FinanceTransactionData, ProductData, IdempotencyLogEntry } from '../state.js';
import { requireTenant, AuthenticatedRequest, validateBody } from '../middleware.js';

export const syncRouter = Router();

const BatchSyncOperationSchema = z.object({
  id: z.string().min(1, 'Operation ID is required'),
  idempotencyKey: z.string().optional(),
  tenantId: z.string().min(1, 'tenantId is required'),
  action: z.string().min(1, 'action is required'),
  payload: z.unknown()
});

const BatchSyncDtoSchema = z.object({
  companyId: z.string().optional(),
  operations: z.array(BatchSyncOperationSchema).min(1, 'operations array cannot be empty')
});

// In-process tenant mutex for true concurrency isolation between parallel requests
const tenantMutexes = new Map<string, Promise<void>>();

async function acquireTenantLock<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const currentPromise = tenantMutexes.get(tenantId) || Promise.resolve();
  let releaseLock: () => void;
  const newPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  tenantMutexes.set(tenantId, currentPromise.then(() => newPromise));

  await currentPromise;
  try {
    return await fn();
  } finally {
    releaseLock!();
    if (tenantMutexes.get(tenantId) === newPromise) {
      tenantMutexes.delete(tenantId);
    }
  }
}

// Zod Schemas for Runtime Action Payloads
const SaleItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().optional(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  total: z.number().nonnegative().optional()
});

const SaleCreateSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().optional(),
  branchId: z.string().optional(),
  items: z.array(SaleItemSchema).min(1),
  total: z.number().nonnegative(),
  paymentMethod: z.enum(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO']).optional(),
  timestamp: z.string().optional(),
  operator: z.string().optional()
});

const StockAdjustSchema = z.object({
  productId: z.string().min(1),
  newStock: z.number().nonnegative(),
  delta: z.number().optional(),
  reason: z.string().optional()
});

const StockItemSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  stock: z.number().nonnegative().optional(),
  stockQuantity: z.number().nonnegative().optional()
});

const FinanceTransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  paymentMethod: z.enum(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA', 'BOLETO']).optional(),
  timestamp: z.string().optional(),
  operator: z.string().optional(),
  referenceId: z.string().optional()
});

const CustomerCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
  points: z.number().optional(),
  tier: z.enum(['Bronze', 'Silver', 'Gold', 'VIP']).optional(),
  totalSpent: z.number().optional()
});

const CustomerPointsAdjustSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().optional(),
  newPoints: z.number().optional(),
  newTier: z.enum(['Bronze', 'Silver', 'Gold', 'VIP']).optional()
});

const TableUpdateSchema = z.object({
  id: z.string().min(1),
  number: z.number().positive().optional(),
  name: z.string().optional(),
  capacity: z.number().positive().optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLING']).optional(),
  currentOrder: z.record(z.string(), z.unknown()).optional()
});

const TableCloseSchema = z.object({
  tableId: z.string().min(1)
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}

// Capability matrix per action
const ACTION_PERMISSIONS: Record<string, string[]> = {
  'sale.create': ['admin', 'manager', 'operator', 'hq_admin'],
  'stock.adjust': ['admin', 'manager', 'hq_admin'],
  'stock.item.save': ['admin', 'manager', 'hq_admin'],
  'finance.transaction': ['admin', 'manager', 'hq_admin'],
  'customer.create': ['admin', 'manager', 'operator', 'hq_admin'],
  'customer.points.adjust': ['admin', 'manager', 'operator', 'hq_admin'],
  'table.update': ['admin', 'manager', 'operator', 'hq_admin'],
  'table.close': ['admin', 'manager', 'operator', 'hq_admin']
};

const ACTION_REQUIRED_APPS: Record<string, string> = {
  'sale.create': 'app_pos',
  'stock.adjust': 'app_inventory',
  'stock.item.save': 'app_inventory',
  'finance.transaction': 'app_finance',
  'customer.create': 'app_crm',
  'customer.points.adjust': 'app_crm',
  'table.update': 'app_tables',
  'table.close': 'app_tables'
};

syncRouter.post('/batch', requireTenant, validateBody(BatchSyncDtoSchema), async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const companyId = req.user.role === 'hq_admin' ? (req.body?.companyId || req.user.companyId) : req.user.companyId;
  const { operations } = req.body;

  // Execute entire batch inside tenant lock to guarantee ACID serialized execution
  await acquireTenantLock(companyId, async () => {
    const acks: { opId: string; idempotencyKey: string; status: 'ACK' | 'DUPLICATE' | 'FAILED'; error?: string; serverTimestamp: string }[] = [];
    const serverTimestamp = new Date().toISOString();
    const userRole = req.user!.role;

    // Deep Snapshot maps for Unit of Work (True Transactional Rollback)
    const salesSnapshot = new Map<string, SaleData>();
    for (const [k, v] of centralState.sales.entries()) {
      salesSnapshot.set(k, structuredClone(v));
    }
    const productsSnapshot = new Map<string, ProductData>();
    for (const [k, v] of centralState.products.entries()) {
      productsSnapshot.set(k, structuredClone(v));
    }
    const financeSnapshot = new Map<string, FinanceTransactionData>();
    for (const [k, v] of centralState.financeTransactions.entries()) {
      financeSnapshot.set(k, structuredClone(v));
    }
    const customersSnapshot = new Map<string, CustomerData>();
    for (const [k, v] of centralState.customers.entries()) {
      customersSnapshot.set(k, structuredClone(v));
    }
    const tablesSnapshot = new Map<string, TableData>();
    for (const [k, v] of centralState.tables.entries()) {
      tablesSnapshot.set(k, structuredClone(v));
    }
    const idempotencySnapshot = new Map<string, IdempotencyLogEntry>();
    for (const [k, v] of centralState.syncIdempotencyLog.entries()) {
      idempotencySnapshot.set(k, structuredClone(v));
    }

    let batchFailed = false;

    for (const op of operations) {
      const { id: opId, idempotencyKey, tenantId, action, payload } = op || {};

      if (!tenantId || tenantId !== companyId) {
        acks.push({
          opId,
          idempotencyKey: idempotencyKey || opId,
          status: 'FAILED',
          error: `Acesso negado: A operação pertence ao tenant '${tenantId}', mas a sessão está autenticada como '${companyId}'.`,
          serverTimestamp
        });
        batchFailed = true;
        break;
      }

      // Idempotency check
      if (idempotencyKey && (centralState.syncIdempotencyLog.has(idempotencyKey) || centralDatabase.isIdempotencyProcessed(idempotencyKey))) {
        acks.push({
          opId,
          idempotencyKey,
          status: 'DUPLICATE',
          serverTimestamp
        });
        continue;
      }

      // Role capability matrix check
      const allowedRoles = ACTION_PERMISSIONS[action];
      if (!allowedRoles || !allowedRoles.includes(userRole)) {
        acks.push({
          opId,
          idempotencyKey: idempotencyKey || opId,
          status: 'FAILED',
          error: `Acesso negado: Função '${userRole}' não possui autorização para executar a ação '${action}'.`,
          serverTimestamp
        });
        batchFailed = true;
        break;
      }

      // App Entitlement validation
      const requiredApp = ACTION_REQUIRED_APPS[action];
      if (requiredApp && companyId) {
        const tenantCompany = centralState.companies.get(companyId);
        if (tenantCompany && Array.isArray(tenantCompany.installedApps) && !tenantCompany.installedApps.includes(requiredApp)) {
          acks.push({
            opId,
            idempotencyKey: idempotencyKey || opId,
            status: 'FAILED',
            error: `Acesso negado: O aplicativo '${requiredApp}' não está instalado para esta empresa.`,
            serverTimestamp
          });
          batchFailed = true;
          break;
        }
      }

      try {
        let actionHandled = false;

        if (action === 'sale.create') {
          const parsed = SaleCreateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do payload da venda falhou: ${formatZodError(parsed.error)}`);
          }
          const salePayload = { ...parsed.data, companyId } as SaleData;
          if (req.user?.branchId) salePayload.branchId = req.user.branchId;

          if (salePayload.id) {
            // Ownership / Security validation: cannot overwrite another tenant's sale
            if (centralState.sales.has(salePayload.id)) {
              const existingSale = centralState.sales.get(salePayload.id)!;
              if (existingSale.companyId !== companyId) {
                throw new Error('Acesso negado: Tentativa de alteração de venda pertencente a outra empresa.');
              }
            }

            // Atomic Domain Side Effects: Deduct inventory stock for sold items with commercial policies
            if (Array.isArray(salePayload.items)) {
              const company = centralState.companies.get(companyId);
              const allowNegative = company?.allowNegativeStock ?? false;

              for (const item of salePayload.items) {
                const qty = Number(item.quantity);
                if (isNaN(qty) || qty <= 0) {
                  throw new Error('Invariante violada: A quantidade de cada item na venda deve ser maior que zero.');
                }

                if (item.productId) {
                  const prod = centralState.products.get(item.productId);
                  if (!prod) {
                    throw new Error(`Invariante violada: Produto '${item.productId}' não encontrado no catálogo.`);
                  }
                  if (prod.companyId !== companyId) {
                    throw new Error(`Acesso negado: O produto '${prod.name}' (${item.productId}) pertence a outra empresa.`);
                  }

                  const resultingStock = prod.stock - qty;
                  if (resultingStock < 0 && !allowNegative) {
                    throw new Error(`Estoque insuficiente para o produto '${prod.name}'. Estoque atual: ${prod.stock}, quantidade solicitada: ${qty}.`);
                  }

                  prod.stock = Math.max(0, resultingStock);
                  centralState.products.set(item.productId, prod);
                }
              }
            }

            centralState.sales.set(salePayload.id, salePayload);

            // Atomic Domain Side Effect: Create financial transaction record if not present
            const finId = `fin_sale_${salePayload.id}`;
            const existingTableTxId = `tx_table_${salePayload.id}`;
            const hasExistingTx = Array.from(centralState.financeTransactions.values()).some(
              t => t.companyId === companyId && (t.referenceId === salePayload.id || t.id === finId || t.id === existingTableTxId)
            );

            if (!hasExistingTx) {
              centralState.financeTransactions.set(finId, {
                id: finId,
                companyId,
                branchId: req.user?.branchId,
                type: 'INFLOW',
                category: 'SALE',
                description: `Venda balcão / PDV #${salePayload.id.slice(-6)}`,
                amount: salePayload.total,
                paymentMethod: (salePayload.paymentMethod as 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO') || 'DINHEIRO',
                timestamp: salePayload.timestamp || serverTimestamp,
                operator: salePayload.operator || req.user!.name,
                referenceId: salePayload.id
              });
            }

            actionHandled = true;
          }
        } else if (action === 'stock.adjust') {
          const parsed = StockAdjustSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do ajuste de estoque falhou: ${formatZodError(parsed.error)}`);
          }
          const stockPayload = parsed.data;
          if (centralState.products.has(stockPayload.productId)) {
            const prod = centralState.products.get(stockPayload.productId)!;
            if (req.user!.role !== 'hq_admin' && prod.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de ajustar estoque de produto de outra empresa.');
            }
            prod.stock = stockPayload.newStock;
            centralState.products.set(stockPayload.productId, prod);
            actionHandled = true;
          } else {
            throw new Error(`Invariante violada: Produto '${stockPayload.productId}' não encontrado para ajuste de estoque.`);
          }
        } else if (action === 'stock.item.save') {
          const parsed = StockItemSaveSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do cadastro de produto falhou: ${formatZodError(parsed.error)}`);
          }
          const itemPayload = parsed.data;
          const itemId = itemPayload.id || `prod_${Date.now()}`;
          if (centralState.products.has(itemId)) {
            const existingProd = centralState.products.get(itemId)!;
            if (existingProd.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar produto de outra empresa.');
            }
          }
          centralState.products.set(itemId, {
            id: itemId,
            companyId,
            name: itemPayload.name,
            price: Number(itemPayload.salePrice ?? itemPayload.price) || 0,
            stock: Number(itemPayload.stockQuantity ?? itemPayload.stock) || 0
          });
          actionHandled = true;
        } else if (action === 'finance.transaction') {
          const parsed = FinanceTransactionSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação da movimentação financeira falhou: ${formatZodError(parsed.error)}`);
          }
          const finPayload = { ...parsed.data, companyId } as FinanceTransactionData;
          if (req.user?.branchId) finPayload.branchId = req.user.branchId;

          // Check for financial entry deduplication if linked to a sale reference
          if (finPayload.referenceId) {
            const existingRefTx = Array.from(centralState.financeTransactions.values()).find(
              t => t.companyId === companyId && t.referenceId === finPayload.referenceId
            );
            if (existingRefTx && existingRefTx.id !== finPayload.id) {
              // Update existing reference transaction instead of duplicating
              existingRefTx.amount = finPayload.amount;
              existingRefTx.paymentMethod = finPayload.paymentMethod || existingRefTx.paymentMethod;
              existingRefTx.description = finPayload.description || existingRefTx.description;
              centralState.financeTransactions.set(existingRefTx.id, existingRefTx);
              actionHandled = true;
            }
          }

          if (!actionHandled) {
            if (centralState.financeTransactions.has(finPayload.id)) {
              const existingTx = centralState.financeTransactions.get(finPayload.id)!;
              if (existingTx.companyId !== companyId) {
                throw new Error('Acesso negado: Tentativa de alterar movimentação financeira de outra empresa.');
              }
            }
            centralState.financeTransactions.set(finPayload.id, finPayload);
            actionHandled = true;
          }
        } else if (action === 'customer.create') {
          const parsed = CustomerCreateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do cadastro de cliente falhou: ${formatZodError(parsed.error)}`);
          }
          const custPayload = { ...parsed.data, companyId } as CustomerData;
          if (req.user?.branchId) custPayload.branchId = req.user.branchId;

          if (centralState.customers.has(custPayload.id)) {
            const existingCust = centralState.customers.get(custPayload.id)!;
            if (existingCust.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar cliente de outra empresa.');
            }
          }
          centralState.customers.set(custPayload.id, custPayload);
          actionHandled = true;
        } else if (action === 'customer.points.adjust') {
          const parsed = CustomerPointsAdjustSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do ajuste de pontos falhou: ${formatZodError(parsed.error)}`);
          }
          const ptsPayload = parsed.data;
          if (centralState.customers.has(ptsPayload.customerId)) {
            const cust = centralState.customers.get(ptsPayload.customerId)!;
            if (req.user!.role !== 'hq_admin' && cust.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de ajustar pontos de cliente de outra empresa.');
            }
            if (ptsPayload.newPoints !== undefined) {
              cust.points = ptsPayload.newPoints;
            } else if (ptsPayload.amount !== undefined) {
              cust.points = (cust.points || 0) + ptsPayload.amount;
            }
            if (ptsPayload.newTier) {
              cust.tier = ptsPayload.newTier as 'Bronze' | 'Silver' | 'Gold' | 'VIP';
            }
            centralState.customers.set(ptsPayload.customerId, cust);
            actionHandled = true;
          } else {
            throw new Error('Invariante violada: Cliente não encontrado para ajuste de pontuação.');
          }
        } else if (action === 'table.update') {
          const parsed = TableUpdateSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação da mesa falhou: ${formatZodError(parsed.error)}`);
          }
          const tablePayload = { ...parsed.data, companyId } as unknown as TableData;
          if (req.user?.branchId) tablePayload.branchId = req.user.branchId;

          if (centralState.tables.has(tablePayload.id)) {
            const existingTbl = centralState.tables.get(tablePayload.id)!;
            if (existingTbl.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de alterar mesa/comanda de outra empresa.');
            }
          }
          centralState.tables.set(tablePayload.id, tablePayload);
          actionHandled = true;
        } else if (action === 'table.close') {
          const parsed = TableCloseSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error(`Validação do fechamento de mesa falhou: ${formatZodError(parsed.error)}`);
          }
          const closePayload = parsed.data;
          if (centralState.tables.has(closePayload.tableId)) {
            const tbl = centralState.tables.get(closePayload.tableId)!;
            if (req.user!.role !== 'hq_admin' && tbl.companyId !== companyId) {
              throw new Error('Acesso negado: Tentativa de fechar mesa/comanda de outra empresa.');
            }
            tbl.status = 'AVAILABLE';
            tbl.currentOrder = undefined;
            centralState.tables.set(closePayload.tableId, tbl);
            actionHandled = true;
          } else {
            throw new Error('Invariante violada: Mesa/Comanda não encontrada para fechamento.');
          }
        }

        if (!actionHandled) {
          throw new Error(`Operação não tratada ou ação inválida: ${action}`);
        }

        // Record idempotency token
        if (idempotencyKey) {
          const entry = {
            status: 'ACK',
            processedAt: serverTimestamp,
            response: { opId, action, companyId }
          };
          try {
            centralDatabase.saveIdempotencyEntry(idempotencyKey, entry);
          } catch (dbErr) {
            console.error('[SQLite] Failed to write idempotency entry directly:', dbErr);
          }
          centralState.syncIdempotencyLog.set(idempotencyKey, entry);
        }

        acks.push({
          opId,
          idempotencyKey: idempotencyKey || opId,
          status: 'ACK',
          serverTimestamp
        });
      } catch (err) {
        acks.push({
          opId,
          idempotencyKey: idempotencyKey || opId,
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
          serverTimestamp
        });
        batchFailed = true;
        break;
      }
    }

    // Transaction Rollback (Unit of Work): If any operation failed, restore state snapshot
    if (batchFailed) {
      centralState.sales = salesSnapshot;
      centralState.products = productsSnapshot;
      centralState.financeTransactions = financeSnapshot;
      centralState.customers = customersSnapshot;
      centralState.tables = tablesSnapshot;
      centralState.syncIdempotencyLog = idempotencySnapshot;
    } else {
      saveIdempotencyLog(centralState.syncIdempotencyLog);
      saveCentralState(true);
    }

    res.json({
      success: !batchFailed,
      processedCount: batchFailed ? 0 : acks.filter(a => a.status === 'ACK' || a.status === 'DUPLICATE').length,
      failedCount: acks.filter(a => a.status === 'FAILED').length,
      rolledBack: batchFailed,
      serverTimestamp,
      acks
    });
  });
});
