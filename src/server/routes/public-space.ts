import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { centralState, saveCentralState, PublicSpaceData, PublicOrderData } from '../state.js';
import { requireTenantRole, requireTenant, AuthenticatedRequest, validateBody } from '../middleware.js';

export const publicSpaceRouter = Router();

const UpdatePublicSpaceSchema = z.object({
  companySlug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  templateId: z.string().optional(),
  themeColor: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.string().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  products: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    available: z.boolean().optional()
  })).optional()
});

const CreatePublicOrderSchema = z.object({
  companyId: z.string().min(1, 'companyId é obrigatório'),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().positive(),
    price: z.number().optional()
  })).min(1, 'O pedido deve conter pelo menos 1 item'),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  channel: z.enum(['MARKETPLACE', 'DIRECT', 'IFOOD']).optional()
});

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'])
});

// Known coordinates for established demonstration flagship branches
const KNOWN_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'comp_burger': { lat: -23.5580, lng: -46.6620 },   // Rua Augusta, 1500 (Consolação)
  'comp_fashion': { lat: -23.5651, lng: -46.6685 },  // Rua Oscar Freire, 800 (Jardins)
  'comp_pet': { lat: -23.5670, lng: -46.6610 }       // Al. Lorena, 1200 (Jardins)
};

// Evaluate whether the business is currently open based on hours string
function evaluateIsOpen(hoursStr: string): boolean {
  if (!hoursStr) return true;
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const normalized = hoursStr.toLowerCase();

    let dayAllowed = false;
    if (normalized.includes('dom') || normalized.includes('diariamente') || normalized.includes('todos')) {
      dayAllowed = true;
    } else if (normalized.includes('seg a sab') || normalized.includes('seg - sab')) {
      dayAllowed = currentDay >= 1 && currentDay <= 6;
    } else if (normalized.includes('seg a sex') || normalized.includes('seg - sex')) {
      dayAllowed = currentDay >= 1 && currentDay <= 5;
    } else {
      dayAllowed = true;
    }

    if (!dayAllowed) return false;

    // Parse hour formats: "11h30 às 23h30", "08h00 às 18h00", "08:00 às 18:00", "11:30 - 23:30"
    const match = normalized.match(/(\d{1,2})(?:h|:)?(\d{2})?\s*(?:às|as|-)\s*(\d{1,2})(?:h|:)?(\d{2})?/);
    if (match) {
      const openHour = parseInt(match[1], 10);
      const openMin = match[2] ? parseInt(match[2], 10) : 0;
      const closeHour = parseInt(match[3], 10);
      const closeMin = match[4] ? parseInt(match[4], 10) : 0;

      const currentTotalMin = currentHour * 60 + currentMinute;
      const openTotalMin = openHour * 60 + openMin;
      const closeTotalMin = closeHour * 60 + closeMin;

      if (closeTotalMin > openTotalMin) {
        return currentTotalMin >= openTotalMin && currentTotalMin < closeTotalMin;
      } else {
        // Crosses midnight (e.g. 18h00 às 02h00)
        return currentTotalMin >= openTotalMin || currentTotalMin < closeTotalMin;
      }
    }
  } catch {
    return true;
  }
  return true;
}

// Public Space by Slug (for public web catalog/menu)
publicSpaceRouter.get('/public-space/slug/:companySlug', (req, res) => {
  const companySlug = req.params['companySlug'] as string;
  for (const comp of centralState.companies.values()) {
    const spaceData = centralState.publicSpaces.get(comp.id);
    const slug = spaceData?.companySlug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    if (slug === companySlug.toLowerCase()) {
      if (comp.status !== 'active') {
        res.status(403).json({ error: 'Espaço público indisponível ou suspenso comercialmente.' });
        return;
      }
      
      if (spaceData && spaceData.status !== 'published') {
        res.status(404).json({ error: 'Este espaço público ainda não foi publicado pelo estabelecimento (Rascunho).' });
        return;
      }

      const activeTemplate = (spaceData?.templateId === 'modern-bistro' ? 'restaurant' : spaceData?.templateId) || 'restaurant';

      res.json({
        id: comp.id,
        name: comp.name,
        slug: companySlug,
        branches: comp.branches || [],
        space: spaceData || null,
        title: spaceData?.title || comp.name,
        description: spaceData?.description || '',
        logo: spaceData?.logo || '',
        templateId: activeTemplate,
        themeColor: spaceData?.themeColor || '#4f46e5',
        status: spaceData?.status || 'published',
        phone: spaceData?.phone || comp.branches?.[0]?.phone || '',
        email: spaceData?.email || '',
        address: spaceData?.address || comp.branches?.[0]?.address || '',
        hours: spaceData?.hours || '',
        products: spaceData?.products || []
      });
      return;
    }
  }
  res.status(404).json({ error: 'Espaço público do cliente não encontrado.' });
});

// Public Space by Company ID (For Internal Tenant Preview and Editing)
publicSpaceRouter.get('/public-space/:companyId', requireTenant, (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== companyId) {
    res.status(403).json({ error: 'Acesso negado. Você só pode visualizar as configurações do seu próprio espaço público.' });
    return;
  }
  
  const space = centralState.publicSpaces.get(companyId);
  if (space) {
    const activeTemplate = (space.templateId === 'modern-bistro' ? 'restaurant' : space.templateId) || 'restaurant';
    res.json({ ...space, templateId: activeTemplate });
  } else {
    // Generate in-memory default response without persisting to central store
    const company = centralState.companies.get(companyId);
    const defaultSpace: PublicSpaceData = {
      companyId,
      companySlug: (company?.name || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: company?.name || 'Catálogo Digital',
      description: 'Presença digital oficial powered by 3eatcru OS',
      logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
      templateId: 'restaurant',
      themeColor: '#4f46e5',
      status: 'published',
      publishedAt: new Date().toISOString(),
      phone: company?.branches?.[0]?.phone || '(11) 99999-9999',
      email: 'contato@empresa.com',
      address: company?.branches?.[0]?.address || 'Av. Principal, 1000',
      hours: 'Seg - Sex: 08h às 18h',
      products: []
    };
    res.json(defaultSpace);
  }
});

// Update Public Space Configuration (Tenant Admin / Manager)
publicSpaceRouter.put('/public-space/:companyId', requireTenantRole(['admin', 'manager']), validateBody(UpdatePublicSpaceSchema), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const existing = centralState.publicSpaces.get(companyId);
  const data = req.body;

  const inputTemplate = data.templateId || existing?.templateId || 'restaurant';
  const activeTemplate = inputTemplate === 'modern-bistro' ? 'restaurant' : inputTemplate;

  const updated: PublicSpaceData = {
    companyId,
    companySlug: data.companySlug || existing?.companySlug || 'loja',
    title: data.title || existing?.title || 'Catálogo Digital',
    description: data.description || existing?.description || '',
    logo: data.logo || existing?.logo || '',
    templateId: activeTemplate,
    themeColor: data.themeColor || existing?.themeColor || '#4f46e5',
    status: data.status || existing?.status || 'published',
    publishedAt: data.publishedAt || existing?.publishedAt || new Date().toISOString(),
    phone: data.phone || existing?.phone || '',
    email: data.email || existing?.email || '',
    address: data.address || existing?.address || '',
    hours: data.hours || existing?.hours || '',
    products: Array.isArray(data.products) ? data.products : (existing?.products || [])
  };

  centralDatabase.upsertPublicSpaceTransaction(updated);
  centralState.publicSpaces.set(companyId, updated);
  saveCentralState(true);
  res.json({ success: true, space: updated });
});

// Semantic Publish Endpoint (Tenant Admin / Manager)
publicSpaceRouter.post('/public-space/:companyId/publish', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const existing = centralState.publicSpaces.get(companyId);
  const company = centralState.companies.get(companyId);

  const space: PublicSpaceData = existing || {
    companyId,
    companySlug: (company?.name || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '-'),
    title: company?.name || 'Catálogo Digital',
    description: 'Presença digital oficial powered by 3eatcru OS',
    logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
    templateId: 'restaurant',
    themeColor: '#4f46e5',
    status: 'draft',
    publishedAt: null,
    phone: company?.branches?.[0]?.phone || '',
    email: '',
    address: company?.branches?.[0]?.address || '',
    hours: 'Seg - Sex: 08h às 18h',
    products: []
  };

  space.status = 'published';
  space.publishedAt = new Date().toISOString();

  centralDatabase.upsertPublicSpaceTransaction(space);
  centralState.publicSpaces.set(companyId, space);
  saveCentralState(true);
  res.json({ success: true, message: 'Espaço público publicado com sucesso.', space });
});

// Semantic Unpublish Endpoint (Tenant Admin / Manager)
publicSpaceRouter.post('/public-space/:companyId/unpublish', requireTenantRole(['admin', 'manager']), (req: AuthenticatedRequest, res) => {
  const companyId = req.params['companyId'] as string;
  const space = centralState.publicSpaces.get(companyId);

  if (!space) {
    res.status(404).json({ error: 'Espaço público não encontrado.' });
    return;
  }

  space.status = 'draft';
  centralDatabase.upsertPublicSpaceTransaction(space);
  centralState.publicSpaces.set(companyId, space);
  saveCentralState(true);
  res.json({ success: true, message: 'Espaço público revertido para rascunho com sucesso.', space });
});

// Marketplace Listings (Aggregates published public spaces into searchable directory with high-fidelity real calculations)
publicSpaceRouter.get('/marketplace/listings', (_req, res) => {
  const listings = [];

  for (const [companyId, space] of centralState.publicSpaces.entries()) {
    const comp = centralState.companies.get(companyId);
    if (!comp || comp.status !== 'active' || space.status !== 'published') {
      continue;
    }

    const template = space.templateId === 'modern-bistro' ? 'restaurant' : (space.templateId || 'restaurant');
    let category: 'Restaurantes' | 'Varejo' | 'Serviços' | 'Outros' = 'Restaurantes';
    let subCategory = 'Alimentos & Bebidas';

    if (template === 'retail') {
      category = 'Varejo';
      subCategory = 'Moda & Acessórios';
    } else if (template === 'business') {
      category = 'Serviços';
      subCategory = 'Saúde, Beleza & Pet';
    }

    // Authentic coordinates and settings resolution
    const coordinates = KNOWN_COORDINATES[companyId] || null;
    const spaceRecord = space as unknown as Record<string, unknown>;
    const rating = (spaceRecord['rating'] as number | null) ?? null;
    const deliveryFee = (spaceRecord['deliveryFee'] as number | null) ?? 0;
    const deliveryTimeMin = (spaceRecord['deliveryTimeMin'] as string | null) ?? (template === 'business' ? 'Sob agendamento' : null);
    const calculatedDistance = null;
    const isOpen = evaluateIsOpen(space.hours);

    listings.push({
      companyId,
      companySlug: space.companySlug || comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: space.title || comp.name,
      description: space.description || '',
      logo: space.logo || '',
      templateId: template,
      status: space.status,
      category,
      subCategory,
      address: space.address || comp.branches?.[0]?.address || '',
      phone: space.phone || comp.branches?.[0]?.phone || '',
      email: space.email || '',
      hours: space.hours || '',
      coordinates,
      capabilities: { 
        delivery: template !== 'business', 
        pickup: true, 
        booking: template === 'business' 
      },
      rating,
      deliveryTimeMin,
      deliveryFee,
      productsCount: space.products ? space.products.length : 0,
      calculatedDistance,
      isOpen
    });
  }

  res.json(listings);
});

// Create Public Space / Marketplace Order (Strictly Server-Authoritative Price & Stock)
publicSpaceRouter.post('/public-space/orders', validateBody(CreatePublicOrderSchema), (req, res) => {
  const { companyId, customerName, customerPhone, customerAddress, items, notes, paymentMethod, channel } = req.body;

  if (!centralState.companies.has(companyId)) {
    res.status(404).json({ error: 'Empresa ou catálogo não encontrado.' });
    return;
  }

  const company = centralState.companies.get(companyId)!;
  if (company.status !== 'active') {
    res.status(403).json({ error: 'Empresa indisponível para pedidos no momento.' });
    return;
  }

  const space = centralState.publicSpaces.get(companyId);
  const catalogProducts = space?.products || [];
  const masterProducts = Array.from(centralState.products.values()).filter(p => p.companyId === companyId);

  let total = 0;
  const orderItems = [];
  const stockDeductions = new Map<string, number>();

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    
    // Strict lookup: No unlisted products and NO client-side price injection!
    const matchedProduct = catalogProducts.find(p => p.name.toLowerCase() === String(it.name || '').toLowerCase());
    let officialPrice = 0;
    let prodId: string | undefined = it.productId ? String(it.productId) : undefined;

    if (matchedProduct) {
      officialPrice = matchedProduct.price;
      const masterMatch = masterProducts.find(p => p.name.toLowerCase() === matchedProduct!.name.toLowerCase());
      if (masterMatch) {
        prodId = masterMatch.id;
      }
    } else {
      // Look up in company's master products
      const masterMatch = masterProducts.find(p => p.id === it.productId || p.name.toLowerCase() === String(it.name || '').toLowerCase());
      if (masterMatch) {
        officialPrice = masterMatch.price;
        prodId = masterMatch.id;
      } else {
        res.status(422).json({ error: `O produto '${it.name || 'Desconhecido'}' não está disponível no catálogo.` });
        return;
      }
    }

    // Accumulate stock deductions
    if (prodId) {
      const currentDeduction = stockDeductions.get(prodId) || 0;
      stockDeductions.set(prodId, currentDeduction + qty);
    }

    const itemTotal = qty * officialPrice;
    total += itemTotal;
    orderItems.push({
      name: matchedProduct ? matchedProduct.name : (it.name || 'Produto'),
      quantity: qty,
      unitPrice: officialPrice,
      total: itemTotal,
      productId: prodId
    });
  }

  // Pre-flight check: Verify ALL stock availability before deducting to ensure atomic transaction
  for (const [prodId, totalQtyNeeded] of stockDeductions.entries()) {
    const dbProduct = centralState.products.get(prodId);
    if (dbProduct) {
      if (dbProduct.stock < totalQtyNeeded && !company.allowNegativeStock) {
        res.status(409).json({ error: `Estoque insuficiente para o produto '${dbProduct.name}'. Disponível: ${dbProduct.stock}, Necessário: ${totalQtyNeeded}` });
        return;
      }
    }
  }

  // Apply all deductions atomically
  for (const [prodId, totalQtyNeeded] of stockDeductions.entries()) {
    const dbProduct = centralState.products.get(prodId);
    if (dbProduct) {
      dbProduct.stock -= totalQtyNeeded;
      centralState.products.set(prodId, dbProduct);
    }
  }

  // Create order with unguessable 128-bit public tracking token
  const orderId = `ord_pub_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const publicTrackingToken = randomUUID();

  const orderRecord: PublicOrderData = {
    id: orderId,
    publicTrackingToken,
    companyId,
    companyName: company.name,
    customerName: String(customerName || 'Cliente Online'),
    customerPhone: String(customerPhone || ''),
    customerAddress: String(customerAddress || ''),
    items: orderItems,
    total,
    notes: String(notes || ''),
    paymentMethod: String(paymentMethod || 'PIX'),
    status: 'RECEIVED',
    channel: (channel || 'MARKETPLACE') as 'MARKETPLACE' | 'DIRECT' | 'IFOOD',
    createdAt: new Date().toISOString()
  };

  centralDatabase.saveMarketplaceOrderTransaction(orderRecord);
  centralState.orders.set(orderId, orderRecord);
  saveCentralState(true);

  res.status(201).json({
    success: true,
    orderId: publicTrackingToken, // Return the secure unguessable token as the public identifier
    internalOrderId: orderId,
    message: 'Pedido criado com sucesso e despachado para o ecossistema!',
    order: {
      id: publicTrackingToken,
      status: orderRecord.status,
      total: orderRecord.total,
      createdAt: orderRecord.createdAt
    }
  });
});

// GET /public-space/orders/:trackingToken (Public tracking - STRICTLY sanitized, NO PII leaked)
publicSpaceRouter.get('/public-space/orders/:trackingToken', (req, res) => {
  const { trackingToken } = req.params;
  const order = Array.from(centralState.orders.values()).find(
    o => o.publicTrackingToken === trackingToken
  );

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  // Strict sanitation: Return ONLY non-sensitive progress details, never phone/address
  res.json({
    success: true,
    order: {
      id: order.publicTrackingToken || order.id,
      companyId: order.companyId,
      companyName: order.companyName,
      status: order.status,
      total: order.total,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      channel: order.channel,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map(it => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice
      }))
    }
  });
});

// GET /companies/:id/orders (Get all orders for a company) - STRICTLY PROTECTED BY RBAC & TENANT BOUNDARIES
publicSpaceRouter.get('/companies/:id/orders', requireTenantRole(['admin', 'manager', 'operator']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  // Real-time double-verification that user only accesses their own tenant data
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== id) {
    res.status(403).json({ error: 'Acesso negado. Tentativa de IDOR bloqueada.' });
    return;
  }

  const companyOrders = Array.from(centralState.orders.values())
    .filter(o => o.companyId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(companyOrders);
});

// PATCH /public-space/orders/:orderId/status (Update order lifecycle status) - STRICTLY AUTHENTICATED WITH STATE MACHINE
publicSpaceRouter.patch('/public-space/orders/:orderId/status', requireTenantRole(['admin', 'manager', 'operator']), validateBody(UpdateOrderStatusSchema), (req: AuthenticatedRequest, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // Find order by internal orderId or public tracking token
  const order = Array.from(centralState.orders.values()).find(
    o => o.id === orderId || o.publicTrackingToken === orderId
  );

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  // Tenant Isolation check
  if (req.user?.role !== 'hq_admin' && req.user?.companyId !== order.companyId) {
    res.status(403).json({ error: 'Acesso negado. Este pedido pertence a outra empresa.' });
    return;
  }

  const currentStatus = order.status;
  const targetStatus = status as PublicOrderData['status'];

  // State Machine Validation rules
  const allowedTransitions: Record<string, string[]> = {
    'RECEIVED': ['PREPARING', 'CANCELLED'],
    'PREPARING': ['READY', 'CANCELLED'],
    'READY': ['DELIVERING', 'COMPLETED', 'CANCELLED'],
    'DELIVERING': ['COMPLETED', 'CANCELLED'],
    'COMPLETED': [], // Terminal state
    'CANCELLED': []  // Terminal state
  };

  if (currentStatus !== targetStatus) {
    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      res.status(422).json({ 
        error: `Transição de status inválida de '${currentStatus}' para '${targetStatus}'.` 
      });
      return;
    }
  }

  // Update Status
  order.status = targetStatus;
  order.updatedAt = new Date().toISOString();
  centralState.orders.set(order.id, order);

  // Self-healing Cancelled Reversion: If cancelled, refund stock
  if (targetStatus === 'CANCELLED' && currentStatus !== 'CANCELLED') {
    for (const oi of order.items) {
      if (oi.productId) {
        const dbProduct = centralState.products.get(oi.productId);
        if (dbProduct) {
          dbProduct.stock += oi.quantity;
          centralState.products.set(oi.productId, dbProduct);
        }
      }
    }
  }

  // Materialize Sale & Payment only upon transition to COMPLETED
  if (targetStatus === 'COMPLETED' && currentStatus !== 'COMPLETED') {
    const saleId = `sale_${order.id}`;
    if (!centralState.sales.has(saleId)) {
      centralState.sales.set(saleId, {
        id: saleId,
        companyId: order.companyId,
        items: order.items.map(oi => ({
          productId: oi.productId || `prod_custom_${oi.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          quantity: oi.quantity,
          unitPrice: oi.unitPrice
        })),
        total: order.total,
        timestamp: new Date().toISOString(),
        paymentMethod: order.paymentMethod,
        operator: `Online / ${order.customerName}`
      });
    }

    const finId = `fin_${saleId}`;
    if (!centralState.financeTransactions.has(finId)) {
      centralState.financeTransactions.set(finId, {
        id: finId,
        companyId: order.companyId,
        type: 'INFLOW',
        category: 'SALE',
        description: `Pedido Online / Marketplace #${order.id.slice(-6)} (${order.customerName})`,
        amount: order.total,
        paymentMethod: (order.paymentMethod as 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO') || 'PIX',
        timestamp: new Date().toISOString(),
        operator: 'Marketplace Integration',
        referenceId: saleId
      });
    }
  }

  saveCentralState(true);
  res.json({ success: true, order });
});
