import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * 3eatcru Platform Central Database Schema (Drizzle ORM)
 * Provides long-term ACID integrity, relation modeling, and multi-tenant schema isolation.
 */

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug'),
  cnpj: text('cnpj'),
  logoUrl: text('logo_url'),
  balance: real('balance').notNull().default(0),
  installedApps: text('installed_apps').notNull().default('[]'), // JSON array of app IDs
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  plan: text('plan', { enum: ['starter', 'pro', 'enterprise'] }).default('starter'),
  maxTerminals: integer('max_terminals').default(1),
  maxBranches: integer('max_branches').default(1),
  activeTerminals: integer('active_terminals').default(0),
  channel: text('channel', { enum: ['stable', 'beta'] }).default('stable'),
  osTargetVersion: text('os_target_version'),
  licenseExpiresAt: text('license_expires_at'),
  branches: text('branches').default('[]'), // JSON array of BranchData
  allowNegativeStock: integer('allow_negative_stock', { mode: 'boolean' }).default(false),
  isDemo: integer('is_demo', { mode: 'boolean' }).default(false)
});

export const companyUsers = sqliteTable('company_users', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'operator'] }).notNull(),
  password: text('password').notNull(),
  pin: text('pin'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastLogin: text('last_login')
});

export const hqAdmins = sqliteTable('hq_admins', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('hq_admin'),
  password: text('password').notNull(),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(true),
  mfaSecret: text('mfa_secret')
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  monthlyPrice: real('monthly_price').notNull().default(0),
  price: real('price'), // deprecated but kept for backwards compatibility
  maxTerminals: integer('max_terminals').notNull().default(1),
  maxBranches: integer('max_branches').notNull().default(1),
  supportLevel: text('support_level').default('standard'),
  description: text('description').notNull(),
  includedApps: text('included_apps').notNull().default('[]'),
  features: text('features').notNull().default('[]') // JSON array
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  price: real('price').notNull(),
  stock: real('stock').notNull().default(0)
});

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  items: text('items').notNull().default('[]'), // JSON array of items
  total: real('total').notNull(),
  timestamp: text('timestamp').notNull(),
  paymentMethod: text('payment_method'),
  operator: text('operator')
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  points: real('points').notNull().default(0),
  totalSpent: real('total_spent').notNull().default(0),
  tier: text('tier', { enum: ['Bronze', 'Silver', 'Gold', 'VIP'] }).notNull().default('Bronze'),
  createdAt: text('created_at').notNull()
});

export const tables = sqliteTable('tables_registry', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(4),
  status: text('status', { enum: ['AVAILABLE', 'OCCUPIED', 'BILLING', 'RESERVED'] }).notNull().default('AVAILABLE'),
  currentOrder: text('current_order') // JSON representation of currentOrder
});

export const financeTransactions = sqliteTable('finance_transactions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  type: text('type', { enum: ['INFLOW', 'OUTFLOW', 'CASH_IN', 'CASH_OUT'] }).notNull(),
  category: text('category', { enum: ['SALE', 'SUPPLY', 'BLEED', 'EXPENSE', 'SERVICES'] }).notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method', { enum: ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'] }).notNull(),
  timestamp: text('timestamp').notNull(),
  operator: text('operator').notNull(),
  referenceId: text('reference_id')
});

export const publicSpaces = sqliteTable('public_spaces', {
  companyId: text('company_id').primaryKey(),
  companySlug: text('company_slug').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  logo: text('logo').notNull(),
  templateId: text('template_id').notNull(),
  themeColor: text('theme_color').notNull(),
  status: text('status').notNull(),
  publishedAt: text('published_at'),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  address: text('address').notNull(),
  hours: text('hours').notNull(),
  products: text('products').notNull().default('[]') // JSON array
});

export const devices = sqliteTable('devices', {
  deviceId: text('device_id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  platform: text('platform').notNull(),
  osVersion: text('os_version').notNull().default('1.4.3'),
  fingerprintHash: text('fingerprint_hash'),
  installationId: text('installation_id'),
  hardwareId: text('hardware_id'),
  status: text('status', { enum: ['active', 'blocked'] }).notNull().default('active'),
  registeredAt: text('registered_at').notNull(),
  lastSeenAt: text('last_seen_at'),
  ipAddress: text('ip_address')
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number'),
  companyId: text('company_id').notNull(),
  companyName: text('company_name'),
  billingPeriod: text('billing_period'),
  issueDate: text('issue_date'),
  dueDate: text('due_date').notNull(),
  paidAt: text('paid_at'),
  status: text('status').notNull(),
  subtotal: real('subtotal').default(0),
  discount: real('discount').default(0),
  totalAmount: real('total_amount').notNull().default(0),
  amount: real('amount'), // deprecated but kept for compatibility
  items: text('items').notNull().default('[]') // JSON array
});

export const appEntitlements = sqliteTable('app_entitlements', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  appId: text('app_id').notNull(),
  status: text('status', { enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'] }).notNull(),
  pricingModel: text('pricing_model', { enum: ['FREE', 'MONTHLY', 'ONE_TIME'] }).notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('BRL'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  licenseKey: text('license_key')
});

export const appInstallations = sqliteTable('app_installations', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  deviceId: text('device_id'),
  appId: text('app_id').notNull(),
  installedVersion: text('installed_version').notNull(),
  status: text('status', { enum: ['INSTALLED', 'DEPRECATED', 'BLOCKED'] }).notNull(),
  installedAt: text('installed_at').notNull(),
  updatedAt: text('updated_at')
});

export const paymentOrders = sqliteTable('payment_orders', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull(),
  companyId: text('company_id').notNull(),
  paymentMethod: text('payment_method').notNull(),
  method: text('method'), // legacy alias
  gatewayReference: text('gateway_reference'),
  qrCode: text('qr_code'),
  qrCodeCopyPaste: text('qr_code_copy_paste'),
  status: text('status').notNull(),
  amount: real('amount').notNull(),
  createdAt: text('created_at').notNull(),
  confirmedAt: text('confirmed_at'),
  expiresAt: text('expires_at')
});

export const companyLedger = sqliteTable('company_ledger', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  previousBalance: real('previous_balance').notNull(),
  newBalance: real('new_balance').notNull(),
  description: text('description').notNull(),
  referenceId: text('reference_id'),
  timestamp: text('timestamp').notNull()
});

export const hqAuditLogs = sqliteTable('hq_audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  adminId: text('admin_id').notNull(),
  adminName: text('admin_name').notNull(),
  action: text('action').notNull(),
  targetTenantId: text('target_tenant_id'),
  targetTenantName: text('target_tenant_name'),
  details: text('details').notNull(),
  ipAddress: text('ip_address')
});

export const idempotencyLog = sqliteTable('idempotency_log', {
  key: text('key').primaryKey(),
  status: text('status').notNull(),
  processedAt: text('processed_at').notNull(),
  response: text('response').notNull()
});
