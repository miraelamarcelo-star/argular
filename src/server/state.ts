import crypto from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync, statSync, mkdirSync } from 'node:fs';
import { hashPassword, verifyPassword } from './config.js';
import { centralDatabase } from './db/central-db.js';
export { centralDatabase };
import { 
  getDemoPlans, 
  getDemoHqAdmins, 
  getDemoCompanies, 
  getDemoCompanyUsers, 
  getDemoLedger, 
  getDemoCustomers, 
  getDemoProducts, 
  getDemoTables, 
  getDemoPublicSpaces 
} from './fixtures/demo-data.js';

export interface SaleData {
  id: string;
  companyId: string;
  branchId?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
  total: number;
  timestamp: string;
  paymentMethod?: string;
  operator?: string;
}

export interface PublicSpaceProduct {
  name: string;
  price: number;
  desc: string;
}

export interface PublicSpaceData {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: string;
  themeColor: string;
  status: string;
  publishedAt: Date | string | null;
  phone: string;
  email: string;
  address: string;
  hours: string;
  products: PublicSpaceProduct[];
}

export interface TelemetryReport {
  companyId: string;
  companyName: string;
  deviceId?: string;
  timestamp: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
  clientReportedStatus?: 'healthy' | 'warning' | 'critical';
  centralCalculatedHealth?: 'healthy' | 'warning' | 'critical';
  checks: { subsystem: string; status: 'healthy' | 'warning' | 'critical'; details: string }[];
  platform: string;
  version: string;
}

export interface BillingReport {
  companyId: string;
  companyName: string;
  previousBalance: number;
  newBalance: number;
  monthlyCost: number;
  apps: string[];
  previousStatus: string;
  newStatus: string;
}

export interface PlanDefinition {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  maxTerminals: number;
  maxBranches: number;
  description: string;
  includedApps: string[];
  features: string[];
}

export interface InvoiceItemData {
  description: string;
  amount: number;
  type: 'PLAN' | 'EXTRA_APP' | 'ADJUSTMENT';
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  status: 'PAID' | 'PENDING' | 'PAYMENT_CREATED' | 'PAYMENT_CONFIRMED' | 'OVERDUE' | 'CANCELLED';
  subtotal: number;
  discount: number;
  totalAmount: number;
  items: InvoiceItemData[];
}

export interface PaymentOrderData {
  id: string;
  invoiceId: string;
  companyId: string;
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  gatewayReference?: string;
  qrCode?: string;
  qrCodeCopyPaste?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'DUPLICATE_REJECTED';
  amount: number;
  createdAt: string;
  confirmedAt?: string;
}

export interface AppCatalogItem {
  id: string;
  name: string;
  description: string;
  developer: string;
  publisher?: string;
  category: string;
  icon: string;
  pricing: {
    model: 'FREE' | 'ONE_TIME' | 'SUBSCRIPTION_MONTHLY' | 'SUBSCRIPTION_ANNUAL' | 'USAGE_BASED';
    amount: number;
    currency: 'BRL';
  };
  lifecycle: {
    status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUSPENDED' | 'RETIRED' | 'REJECTED';
    publishedAt?: string;
  };
  currentRelease?: {
    version: string;
    minOsVersion?: string;
    releaseChannel: 'stable' | 'beta' | 'canary';
    checksum?: string;
    releasedAt?: string;
  };
  permissions: string[];
  capabilities: string[];
  dependencies: {
    id: string;
    versionRange: string;
  }[];
  isSystemApp: boolean;
}

export interface CompanyLedgerEntry {
  id: string;
  companyId: string;
  type: 'CREDIT_ADDED' | 'PLAN_CHARGE' | 'APP_CHARGE' | 'REFUND';
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  timestamp: string;
}

export interface TenantUserData {
  id: string;
  companyId: string;
  name: string;
  email: string;
  pin: string;
  password?: string;
  role: 'admin' | 'manager' | 'operator';
  branchIds?: string[]; // Array of allowed branch IDs or empty/undefined for all branches
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface HqAdminData {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'hq_admin';
  mfaEnabled: boolean;
  mfaSecret: string;
  recoveryCodes?: string[];
}

export interface HqAuditLogEntry {
  id: string;
  timestamp: string;
  hqAdminId: string;
  hqAdminEmail: string;
  action: string;
  targetCompanyId?: string;
  details: string;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string;
}

export interface OsReleaseData {
  version: string;
  channel: 'stable' | 'beta';
  releaseDate: string;
  status: 'active' | 'deprecated' | 'canary';
  changelog: string;
  minRequiredByApps: string;
  mandatory?: boolean;
  checksum?: string;
}

export interface BranchData {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  address: string;
  phone: string;
  isActive: boolean;
  isMain?: boolean;
  settings?: {
    receiptHeader?: string;
    receiptFooter?: string;
    defaultPrinterProfile?: string;
  };
  createdAt?: string;
}

export interface DeviceRegistrationData {
  deviceId: string;
  companyId: string;
  branchId: string;
  name: string;
  installationId: string;
  fingerprintHash: string;
  platform: 'web' | 'windows' | 'android' | 'linux';
  osVersion: string;
  status: 'active' | 'blocked' | 'pending';
  lastSeenAt: string;
  ipAddress?: string;
  registeredAt: string;
}

export interface CompanyData {
  id: string;
  name: string;
  isDemo?: boolean;
  slug?: string;
  cnpj?: string;
  logoUrl?: string;
  balance: number;
  installedApps: string[];
  status: 'active' | 'suspended';
  plan?: 'starter' | 'pro' | 'enterprise';
  maxTerminals?: number;
  maxBranches?: number;
  activeTerminals?: number;
  channel?: 'stable' | 'beta';
  osTargetVersion?: string;
  licenseExpiresAt?: string;
  branches?: BranchData[];
  allowNegativeStock?: boolean;
}

export interface AppEntitlement {
  id: string;
  companyId: string;
  appId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  pricingModel: 'FREE' | 'MONTHLY' | 'ONE_TIME' | 'SUBSCRIPTION_MONTHLY' | 'SUBSCRIPTION_ANNUAL' | 'USAGE_BASED';
  amount: number;
  currency: 'BRL';
  createdAt: string;
  expiresAt?: string;
  licenseKey?: string;
}

export interface AppInstallation {
  id: string;
  companyId: string;
  deviceId?: string;
  appId: string;
  installedVersion: string;
  status: 'INSTALLED' | 'DEPRECATED' | 'BLOCKED';
  installedAt: string;
  updatedAt?: string;
}

export interface CustomerData {
  id: string;
  companyId: string;
  branchId?: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSpent: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  createdAt: string;
}

export interface ProductData {
  id: string;
  companyId: string;
  name: string;
  price: number;
  stock: number;
}

export interface FinanceTransactionData {
  id: string;
  companyId: string;
  branchId?: string;
  type: 'INFLOW' | 'OUTFLOW' | 'CASH_IN' | 'CASH_OUT';
  category: 'SALE' | 'SUPPLY' | 'BLEED' | 'EXPENSE' | 'SERVICES';
  description: string;
  amount: number;
  paymentMethod: 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';
  timestamp: string;
  operator: string;
  referenceId?: string;
}

export interface PublicOrderItemData {
  name: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  notes?: string;
}

export interface PublicOrderData {
  id: string;
  publicTrackingToken?: string;
  companyId: string;
  branchId?: string;
  companyName: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: PublicOrderItemData[];
  total: number;
  notes?: string;
  paymentMethod: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
  channel: 'MARKETPLACE' | 'DIRECT' | 'IFOOD';
  createdAt: string;
  updatedAt?: string;
}

export interface TableOrderItemData {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  status: 'PENDING_KITCHEN' | 'IN_PREPARATION' | 'READY' | 'SERVED';
  orderedAt: string;
}

export interface TableData {
  id: string;
  companyId: string;
  branchId?: string;
  number: number;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILLING' | 'RESERVED';
  currentOrder?: {
    id: string;
    tableId: string;
    companyId: string;
    items: TableOrderItemData[];
    customerCount: number;
    status: 'OPEN' | 'PAID' | 'CANCELLED';
    openedAt: string;
    waiterName: string;
  };
}

const IDEMPOTENCY_FILE = join(process.cwd(), 'sync_idempotency_log.json');

export interface IdempotencyLogEntry {
  status: string;
  processedAt: string;
  response: unknown;
}

function loadIdempotencyLog(): Map<string, IdempotencyLogEntry> {
  const map = new Map<string, IdempotencyLogEntry>();
  try {
    if (existsSync(IDEMPOTENCY_FILE)) {
      const raw = readFileSync(IDEMPOTENCY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const [key, val] of Object.entries(parsed)) {
        map.set(key, val as IdempotencyLogEntry);
      }
    }
  } catch (err) {
    console.error('Error loading idempotency log:', err);
  }
  return map;
}

export function saveIdempotencyLog(map: Map<string, IdempotencyLogEntry>) {
  try {
    const obj: Record<string, IdempotencyLogEntry> = {};
    for (const [key, val] of map.entries()) {
      obj[key] = val;
    }
    const tmpFile = IDEMPOTENCY_FILE + '.tmp';
    writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf-8');
    renameSync(tmpFile, IDEMPOTENCY_FILE);
  } catch (err) {
    console.error('Error saving idempotency log:', err);
  }
}

const isProd = process.env['NODE_ENV'] === 'production';

function getProdHqAdminPassword(): string {
  const pass = process.env['HQ_ADMIN_PASSWORD'] || process.env['HQ_ADMIN_SECRET'];
  if (!pass) {
    if (process.env['NODE_ENV'] === 'production') {
      console.warn('[SECURITY WARNING] HQ_ADMIN_PASSWORD environment variable is not defined in production. Passwords will fail at runtime unless set.');
      return '';
    }
    return '3eatcru_HQ_SecurePass_2026!';
  }
  return pass;
}

function getProdHqAdminMfaSecret(): string {
  const secret = process.env['HQ_ADMIN_MFA_SECRET'];
  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      console.warn('[SECURITY WARNING] HQ_ADMIN_MFA_SECRET is not defined in production.');
      return '';
    }
    return crypto.randomBytes(20).toString('hex').toUpperCase();
  }
  return secret;
}

export function enforceHqAdminEnvOverrides(): boolean {
  const hqAdminEmail = process.env['HQ_ADMIN_EMAIL'] || 'admin@3eatcru.com.br';
  const hqAdminPass = getProdHqAdminPassword();
  const hqAdminMfa = getProdHqAdminMfaSecret();

  // Filter out any legacy or conflicting admin IDs to avoid clutter
  centralState.hqAdmins = centralState.hqAdmins.filter(admin => admin.id !== 'hq_admin_1');

  let prodAdmin = centralState.hqAdmins.find(admin => admin.id === 'hq_admin_prod');
  let changed = false;

  const hashedPass = hashPassword(hqAdminPass);

  if (!prodAdmin) {
    prodAdmin = {
      id: 'hq_admin_prod',
      name: 'Central 3eatcru HQ Administrator',
      email: hqAdminEmail,
      password: hashedPass,
      role: 'hq_admin',
      mfaEnabled: true,
      mfaSecret: hqAdminMfa
    };
    centralState.hqAdmins.push(prodAdmin);
    changed = true;
  } else {
    if (prodAdmin.email !== hqAdminEmail) {
      prodAdmin.email = hqAdminEmail;
      changed = true;
    }
    // Verify password is still correct; if not, hash the current env password and update
    if (!verifyPassword(hqAdminPass, prodAdmin.password)) {
      prodAdmin.password = hashedPass;
      changed = true;
    }
    if (prodAdmin.mfaSecret !== hqAdminMfa) {
      prodAdmin.mfaSecret = hqAdminMfa;
      changed = true;
    }
  }

  if (changed) {
    console.log('[SECURITY] HQ Admin credentials aligned in memory based on current environment variables.');
  }
  return changed;
}

export const centralState = {
  plans: getDemoPlans(),
  companies: new Map<string, CompanyData>(isProd ? [] : getDemoCompanies()),
  companyUsers: new Map<string, TenantUserData[]>(isProd ? [] : getDemoCompanyUsers()),
  hqAdmins: isProd ? [
    {
      id: 'hq_admin_prod',
      name: 'Central 3eatcru HQ Administrator',
      email: process.env['HQ_ADMIN_EMAIL'] || 'admin@3eatcru.com.br',
      password: hashPassword(getProdHqAdminPassword()),
      role: 'hq_admin',
      mfaEnabled: true,
      mfaSecret: getProdHqAdminMfaSecret()
    }
  ] : getDemoHqAdmins(),
  processedWebhookEvents: new Set<string>(),
  companyLedger: new Map<string, CompanyLedgerEntry[]>(isProd ? [] : getDemoLedger()),

  osReleases: [
    { 
      version: '1.0.0', 
      channel: 'stable', 
      releaseDate: '2026-07-15', 
      status: 'deprecated', 
      changelog: 'Versão inicial com Core Runtime, Window Manager e Desktop Shell.', 
      minRequiredByApps: '1.0.0' 
    },
    { 
      version: '1.1.0-lts', 
      channel: 'stable', 
      releaseDate: '2026-09-01', 
      status: 'active', 
      changelog: 'LTS Estável: Isolamento total de Storage (IndexedDB), motor Outbox de sincronização offline e adapters universais.', 
      minRequiredByApps: '1.0.0' 
    },
    { 
      version: '1.2.0-beta', 
      channel: 'beta', 
      releaseDate: '2026-09-10', 
      status: 'active', 
      changelog: 'Canary/Beta: Barramento de alta velocidade, sincronismo delta otimizado e telemetria de bateria.', 
      minRequiredByApps: '1.1.0' 
    }
  ] as OsReleaseData[],

  apps: [
    { 
      id: 'app_public_space', name: 'Presença Digital', description: 'Configure o seu site ou cardápio público dentro da infraestrutura 3eatcru.', 
      icon: 'public', developer: '3eatcru', category: 'storefront',
      pricing: { model: 'FREE', amount: 0, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: true 
    },
    { 
      id: 'app_settings', name: 'Painel de Controle', description: 'Configure o hardware, impressoras, diagnósticos e atualizações do sistema.', 
      icon: 'settings', developer: '3eatcru', category: 'system',
      pricing: { model: 'FREE', amount: 0, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: true 
    },
    { 
      id: 'app_pos', name: 'Ponto de Venda', description: 'Realize vendas rápidas no balcão.', 
      icon: 'point_of_sale', developer: '3eatcru', category: 'sales',
      pricing: { model: 'MONTHLY', amount: 59.90, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_inventory', name: 'Estoque', description: 'Gerencie seu catálogo de produtos e inventário.', 
      icon: 'inventory_2', developer: '3eatcru', category: 'operations',
      pricing: { model: 'MONTHLY', amount: 39.90, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_tables', name: 'Mesas & Comandas (KDS)', description: 'Gestão de salão, comandas eletrônicas por mesa, status de produção na cozinha (KDS) e pré-conta.', 
      icon: 'table_restaurant', developer: '3eatcru', category: 'restaurant',
      pricing: { model: 'MONTHLY', amount: 69.90, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_crm', name: 'CRM & Fidelidade', description: 'Gestão de clientes, histórico de compras e programa de pontuação de fidelidade com emissão de extrato.', 
      icon: 'loyalty', developer: '3eatcru', category: 'marketing',
      pricing: { model: 'MONTHLY', amount: 39.90, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_finance', name: 'Fluxo de Caixa & Finanças', description: 'Gestão de entradas, despesas, sangrias, suprimentos de caixa e emissão de fechamento com cupom térmico.', 
      icon: 'account_balance_wallet', developer: '3eatcru', category: 'finance',
      pricing: { model: 'MONTHLY', amount: 49.90, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_whatsapp', name: 'WhatsApp Business Hub', description: 'Automação de notificações, envio de recibos digitais e status de pedidos via Webhooks.', 
      icon: 'chat', developer: 'Meta / 3eatcru Ecosystem', category: 'integration',
      pricing: { model: 'MONTHLY', amount: 35.00, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_telegram', name: 'Telegram Manager Bot', description: 'Robô de alertas executivos e operacionais em tempo real para gestores.', 
      icon: 'send', developer: 'Telegram / 3eatcru Ecosystem', category: 'integration',
      pricing: { model: 'MONTHLY', amount: 25.00, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_ifood', name: 'iFood Delivery Hub', description: 'Recepção de pedidos externos do iFood com integração ao KDS de cozinha e impressão automática.', 
      icon: 'delivery_dining', developer: 'iFood / 3eatcru Ecosystem', category: 'integration',
      pricing: { model: 'MONTHLY', amount: 50.00, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: false 
    },
    { 
      id: 'app_health_diagnostics', name: 'Health & Diagnostics', description: 'Monitoramento do PDV, rede, impressoras e sincronismo offline.', 
      icon: 'monitor_heart', developer: '3eatcru', category: 'system',
      pricing: { model: 'FREE', amount: 0, currency: 'BRL' },
      lifecycle: { status: 'PUBLISHED' },
      currentRelease: { version: '1.0.0', minOsVersion: '1.0.0', releaseChannel: 'stable' },
      permissions: ['*'], capabilities: [], dependencies: [], isSystemApp: true 
    }
  ] as AppCatalogItem[],

  osDb: new Map<string, unknown>(),
  customers: new Map<string, CustomerData>(isProd ? [] : getDemoCustomers()),
  products: new Map<string, ProductData>(isProd ? [] : getDemoProducts()),
  sales: new Map<string, SaleData>(),
  publicSpaces: new Map<string, PublicSpaceData>(isProd ? [] : getDemoPublicSpaces()),
  telemetry: new Map<string, TelemetryReport>(),
  financeTransactions: new Map<string, FinanceTransactionData>(),
  tables: new Map<string, TableData>(isProd ? [] : getDemoTables()),
  orders: new Map<string, PublicOrderData>(),
  devices: new Map<string, DeviceRegistrationData>(),
  invoices: new Map<string, InvoiceData[]>(),
  syncIdempotencyLog: loadIdempotencyLog(),
  billingIdempotencyLog: new Map<string, string>(), // Maps billing period + companyId to invoiceId to ensure idempotency
  appEntitlements: new Map<string, AppEntitlement>(), // Key: `${companyId}:${appId}`
  appInstallations: new Map<string, AppInstallation>(), // Key: `${companyId}:${appId}`
  paymentOrders: new Map<string, PaymentOrderData>(), // Key: paymentOrderId
  hqAuditLogs: [] as HqAuditLogEntry[]
};

export function recordHqAuditLog(entry: Omit<HqAuditLogEntry, 'id' | 'timestamp'>) {
  const idSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
  const fullEntry: HqAuditLogEntry = {
    id: `log_${Date.now()}_${idSuffix}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  
  // Database-first insertion
  try {
    centralDatabase.insertAuditLog(fullEntry);
  } catch (err) {
    console.error('[recordHqAuditLog] Error inserting audit log into SQLite:', err);
  }

  centralState.hqAuditLogs.unshift(fullEntry);
}

const DATA_DIR = join(process.cwd(), 'data');
const BACKUPS_DIR = join(DATA_DIR, 'backups');
const CENTRAL_STORE_FILE = join(DATA_DIR, 'central_store.json');
const CENTRAL_STORE_BAK = join(DATA_DIR, 'central_store.json.bak');

export interface CentralStoreDiagnostics {
  status: 'HEALTHY' | 'DEGRADED' | 'RECOVERED_FROM_BACKUP';
  filePath: string;
  backupExists: boolean;
  fileSizeBytes: number;
  lastLoadedAt: string | null;
  lastSavedAt: string | null;
  writeCount: number;
  entities: {
    tenantsCount: number;
    usersCount: number;
    branchesCount: number;
    devicesCount: number;
    invoicesCount: number;
    auditLogsCount: number;
    plansCount: number;
    appsCount: number;
    osReleasesCount: number;
    productsCount: number;
    salesCount: number;
    ordersCount: number;
    customersCount: number;
    financeTransactionsCount: number;
  };
  memoryUsageMb: number;
}

let lastSavedTimestamp: string | null = null;
let lastLoadedTimestamp: string | null = null;
let totalWriteCount = 0;
let storeStatus: 'HEALTHY' | 'DEGRADED' | 'RECOVERED_FROM_BACKUP' = 'HEALTHY';
let isWriting = false;
let pendingSave = false;

export function saveCentralState(skipDbPersist = false) {
  if (isWriting) {
    pendingSave = true;
    return;
  }

  isWriting = true;
  try {
    // 1. Relational SQLite write is the Primary Authority (ACID with WAL).
    // This MUST succeed if we are not skipping it. If it throws, the operation fails and error propagates.
    if (!skipDbPersist) {
      centralDatabase.persistState(centralState);
    }

    // 2. Secondary backup write to central_store.json
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }

      const serialized = {
        plans: centralState.plans,
        hqAdmins: centralState.hqAdmins,
        companies: Array.from(centralState.companies.entries()),
        companyUsers: Array.from(centralState.companyUsers.entries()),
        companyLedger: Array.from(centralState.companyLedger.entries()),
        osDb: Array.from(centralState.osDb.entries()),
        customers: Array.from(centralState.customers.entries()),
        products: Array.from(centralState.products.entries()),
        sales: Array.from(centralState.sales.entries()),
        publicSpaces: Array.from(centralState.publicSpaces.entries()),
        telemetry: Array.from(centralState.telemetry.entries()),
        financeTransactions: Array.from(centralState.financeTransactions.entries()),
        tables: Array.from(centralState.tables.entries()),
        orders: Array.from(centralState.orders.entries()),
        devices: Array.from(centralState.devices.entries()),
        invoices: Array.from(centralState.invoices.entries()),
        billingIdempotencyLog: Array.from(centralState.billingIdempotencyLog.entries()),
        appEntitlements: Array.from(centralState.appEntitlements.entries()),
        appInstallations: Array.from(centralState.appInstallations.entries()),
        paymentOrders: Array.from(centralState.paymentOrders.entries()),
        apps: centralState.apps,
        osReleases: centralState.osReleases,
        hqAuditLogs: centralState.hqAuditLogs
      };

      const tmpFile = CENTRAL_STORE_FILE + '.tmp';
      writeFileSync(tmpFile, JSON.stringify(serialized, null, 2), 'utf-8');

      if (existsSync(CENTRAL_STORE_FILE)) {
        try {
          copyFileSync(CENTRAL_STORE_FILE, CENTRAL_STORE_BAK);
        } catch (backupErr) {
          console.warn('Warning: Could not create secondary central_store.json.bak:', backupErr);
        }
      }

      renameSync(tmpFile, CENTRAL_STORE_FILE);
    } catch (jsonErr) {
      console.warn('[Backup] Warning: Secondary JSON export/backup failed:', jsonErr);
    }

    lastSavedTimestamp = new Date().toISOString();
    totalWriteCount++;
    if (storeStatus !== 'RECOVERED_FROM_BACKUP') {
      storeStatus = 'HEALTHY';
    }
  } catch (err) {
    storeStatus = 'DEGRADED';
    console.error('CRITICAL SQLite Persistence Error in saveCentralState:', err);
    throw new Error('Falha de persistência grave: O banco de dados central (SQLite) não pôde ser gravado em disco.');
  } finally {
    isWriting = false;
    if (pendingSave) {
      pendingSave = false;
      saveCentralState();
    }
  }
}

export function loadCentralState() {
  // P0 Authority: Check if SQLite database has data first (SQLite is Primary Source of Truth)
  if (centralDatabase.hasData()) {
    try {
      const dbState = centralDatabase.loadFromDatabase();
      if (dbState) {
        if (dbState.plans) centralState.plans = dbState.plans as unknown as PlanDefinition[];
        if (dbState.hqAdmins) centralState.hqAdmins = dbState.hqAdmins as unknown as HqAdminData[];
        if (dbState.companies) centralState.companies = new Map(dbState.companies as unknown as [string, CompanyData][]);
        if (dbState.companyUsers) centralState.companyUsers = new Map(dbState.companyUsers as unknown as [string, TenantUserData[]][]);
        if (dbState.products) centralState.products = new Map(dbState.products as unknown as [string, ProductData][]);
        if (dbState.sales) centralState.sales = new Map(dbState.sales as unknown as [string, SaleData][]);
        if (dbState.customers) centralState.customers = new Map(dbState.customers as unknown as [string, CustomerData][]);
        if (dbState.tables) centralState.tables = new Map(dbState.tables as unknown as [string, TableData][]);
        if (dbState.financeTransactions) centralState.financeTransactions = new Map(dbState.financeTransactions as unknown as [string, FinanceTransactionData][]);
        if (dbState.publicSpaces) centralState.publicSpaces = new Map(dbState.publicSpaces as unknown as [string, PublicSpaceData][]);
        if (dbState.orders) centralState.orders = new Map(dbState.orders as unknown as [string, PublicOrderData][]);
        if (dbState.telemetry) centralState.telemetry = new Map(dbState.telemetry as unknown as [string, TelemetryReport][]);
        if (dbState.processedWebhookEvents) centralState.processedWebhookEvents = new Set(dbState.processedWebhookEvents);
        if (dbState.osReleases) centralState.osReleases = dbState.osReleases as unknown as OsReleaseData[];
        if (dbState.apps) centralState.apps = dbState.apps as unknown as AppCatalogItem[];
        if (dbState.billingIdempotencyLog) centralState.billingIdempotencyLog = new Map(dbState.billingIdempotencyLog);
        if (dbState.devices) centralState.devices = new Map(dbState.devices as unknown as [string, DeviceRegistrationData][]);
        if (dbState.invoices) centralState.invoices = new Map(dbState.invoices as unknown as [string, InvoiceData[]][]);
        if (dbState.appEntitlements) centralState.appEntitlements = new Map(dbState.appEntitlements as unknown as [string, AppEntitlement][]);
        if (dbState.appInstallations) centralState.appInstallations = new Map(dbState.appInstallations as unknown as [string, AppInstallation][]);
        if (dbState.paymentOrders) centralState.paymentOrders = new Map(dbState.paymentOrders as unknown as [string, PaymentOrderData][]);
        if (dbState.companyLedger) centralState.companyLedger = new Map(dbState.companyLedger as unknown as [string, CompanyLedgerEntry[]][]);
        if (dbState.hqAuditLogs) centralState.hqAuditLogs = dbState.hqAuditLogs as unknown as HqAuditLogEntry[];
        
        // Enforce dynamic environment credentials alignment
        const changed = enforceHqAdminEnvOverrides();
        if (changed) {
          try {
            centralDatabase.persistState(centralState);
            saveCentralState();
          } catch (e) {
            console.error('Failed to sync aligned admin env overrides to SQLite database:', e);
          }
        }

        storeStatus = 'HEALTHY';
        console.log('[CentralDatabase] State successfully hydrated from Primary SQLite Database.');
        return;
      }
    } catch (dbErr) {
      console.error('[CentralDatabase] Failed to hydrate from SQLite. Attempting fallback to JSON backup:', dbErr);
    }
  }

  let raw: string | null = null;
  let sourcePath = CENTRAL_STORE_FILE;

  if (existsSync(CENTRAL_STORE_FILE)) {
    try {
      raw = readFileSync(CENTRAL_STORE_FILE, 'utf-8');
    } catch (err) {
      console.error('Failed reading primary central_store.json:', err);
    }
  }

  // If primary missing or empty, attempt recovery from backup
  if ((!raw || raw.trim().length === 0) && existsSync(CENTRAL_STORE_BAK)) {
    try {
      raw = readFileSync(CENTRAL_STORE_BAK, 'utf-8');
      sourcePath = CENTRAL_STORE_BAK;
      storeStatus = 'RECOVERED_FROM_BACKUP';
      console.warn('Primary store missing or empty. Recovered central store from backup file (.bak)');
    } catch (bakErr) {
      console.error('Failed reading backup central_store.json.bak:', bakErr);
    }
  }

  if (raw && raw.trim().length > 0) {
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.error('Corrupted JSON detected in central store. Attempting backup recovery:', parseErr);
        if (sourcePath !== CENTRAL_STORE_BAK && existsSync(CENTRAL_STORE_BAK)) {
          const bakRaw = readFileSync(CENTRAL_STORE_BAK, 'utf-8');
          parsed = JSON.parse(bakRaw);
          storeStatus = 'RECOVERED_FROM_BACKUP';
          console.warn('Successfully recovered store from .bak after corruption in primary JSON.');
        } else {
          throw parseErr;
        }
      }
      
      if (parsed['plans']) centralState.plans = parsed['plans'] as PlanDefinition[];
      if (parsed['companies']) centralState.companies = new Map(parsed['companies'] as [string, CompanyData][]);
      if (parsed['companyUsers']) centralState.companyUsers = new Map(parsed['companyUsers'] as [string, TenantUserData[]][]);
      if (parsed['companyLedger']) centralState.companyLedger = new Map(parsed['companyLedger'] as [string, CompanyLedgerEntry[]][]);
      if (parsed['osDb']) centralState.osDb = new Map(parsed['osDb'] as [string, unknown][]);
      if (parsed['customers']) centralState.customers = new Map(parsed['customers'] as [string, CustomerData][]);
      if (parsed['products']) centralState.products = new Map(parsed['products'] as [string, ProductData][]);
      if (parsed['sales']) centralState.sales = new Map(parsed['sales'] as [string, SaleData][]);
      if (parsed['publicSpaces']) centralState.publicSpaces = new Map(parsed['publicSpaces'] as [string, PublicSpaceData][]);
      if (parsed['telemetry']) centralState.telemetry = new Map(parsed['telemetry'] as [string, TelemetryReport][]);
      if (parsed['financeTransactions']) centralState.financeTransactions = new Map(parsed['financeTransactions'] as [string, FinanceTransactionData][]);
      if (parsed['tables']) centralState.tables = new Map(parsed['tables'] as [string, TableData][]);
      if (parsed['orders']) centralState.orders = new Map(parsed['orders'] as [string, PublicOrderData][]);
      if (parsed['devices']) centralState.devices = new Map(parsed['devices'] as [string, DeviceRegistrationData][]);
      if (parsed['invoices']) centralState.invoices = new Map(parsed['invoices'] as [string, InvoiceData[]][]);
      if (parsed['billingIdempotencyLog']) centralState.billingIdempotencyLog = new Map(parsed['billingIdempotencyLog'] as [string, string][]);
      if (parsed['appEntitlements']) centralState.appEntitlements = new Map(parsed['appEntitlements'] as [string, AppEntitlement][]);
      if (parsed['appInstallations']) centralState.appInstallations = new Map(parsed['appInstallations'] as [string, AppInstallation][]);
      if (parsed['paymentOrders']) centralState.paymentOrders = new Map(parsed['paymentOrders'] as [string, PaymentOrderData][]);
      if (parsed['apps']) centralState.apps = parsed['apps'] as AppCatalogItem[];
      if (parsed['osReleases']) centralState.osReleases = parsed['osReleases'] as OsReleaseData[];
      if (parsed['hqAuditLogs']) centralState.hqAuditLogs = parsed['hqAuditLogs'] as HqAuditLogEntry[];

      if (isProd) {
        const PREDEFINED_DEMO_COMPANY_IDS = new Set(['company_pro', 'company_starter', 'comp_burger', 'comp_fashion', 'comp_pet', 'demo_company']);
        const demoCompanyIds = new Set<string>();
        for (const [compId, comp] of centralState.companies.entries()) {
          // P0.1: Explicitly check for isDemo flag or predefined fixture seed IDs.
          // NEVER rely on string prefix like startsWith('demo_') which could accidentally delete real customers.
          if ((comp as { isDemo?: boolean }).isDemo || PREDEFINED_DEMO_COMPANY_IDS.has(compId)) {
            demoCompanyIds.add(compId);
            centralState.companies.delete(compId);
          }
        }
        for (const compId of demoCompanyIds) {
          centralState.companyUsers.delete(compId);
          centralState.companyLedger.delete(compId);
          centralState.invoices.delete(compId);
        }
        const filterByCompany = (map: Map<string, { companyId: string }>) => {
          for (const [key, val] of map.entries()) {
            if (demoCompanyIds.has(val.companyId)) {
              map.delete(key);
            }
          }
        };
        filterByCompany(centralState.customers as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.products as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.sales as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.publicSpaces as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.telemetry as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.financeTransactions as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.tables as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.orders as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.devices as unknown as Map<string, { companyId: string }>);
        filterByCompany(centralState.paymentOrders as unknown as Map<string, { companyId: string }>);

        for (const [key, val] of centralState.appEntitlements.entries()) {
          if (demoCompanyIds.has(val.companyId)) {
            centralState.appEntitlements.delete(key);
          }
        }
        for (const [key, val] of centralState.appInstallations.entries()) {
          if (demoCompanyIds.has(val.companyId)) {
            centralState.appInstallations.delete(key);
          }
        }
        centralState.hqAdmins = centralState.hqAdmins.filter(admin => admin.id !== 'hq_admin_1');
        if (centralState.hqAdmins.length === 0) {
          const prodPass = getProdHqAdminPassword();
          if (prodPass) {
            centralState.hqAdmins.push({
              id: 'hq_admin_prod',
              name: 'Central 3eatcru HQ Administrator',
              email: process.env['HQ_ADMIN_EMAIL'] || 'admin@3eatcru.com.br',
              password: hashPassword(prodPass),
              role: 'hq_admin',
              mfaEnabled: true,
              mfaSecret: process.env['HQ_ADMIN_MFA_SECRET'] || crypto.randomBytes(16).toString('hex')
            });
          } else {
            console.warn('[SECURITY WARNING] HQ Administrator account creation pending HQ_ADMIN_PASSWORD environment variable.');
          }
        }
      }

      let needsReSave = false;

      // Schema Normalization: Plans maxBranches enforcement
      centralState.plans = centralState.plans.map(p => {
        if (!p.maxBranches || p.maxBranches <= 0) {
          needsReSave = true;
          const defaultBranches = p.id === 'enterprise' ? 20 : p.id === 'pro' ? 3 : 1;
          return { ...p, maxBranches: defaultBranches };
        }
        return p;
      });

      // Schema Normalization: Companies maxBranches, activeTerminals, branches, installedApps
      for (const [compId, comp] of centralState.companies.entries()) {
        let changed = false;
        const normalizedComp = { ...comp };

        if (!normalizedComp.maxBranches || normalizedComp.maxBranches <= 0) {
          const planDef = centralState.plans.find(p => p.id === normalizedComp.plan);
          normalizedComp.maxBranches = planDef ? planDef.maxBranches : (normalizedComp.plan === 'enterprise' ? 20 : normalizedComp.plan === 'pro' ? 3 : 1);
          changed = true;
        }

        if (normalizedComp.activeTerminals === undefined || normalizedComp.activeTerminals < 0) {
          normalizedComp.activeTerminals = 1;
          changed = true;
        }

        if (normalizedComp.balance === undefined || isNaN(Number(normalizedComp.balance))) {
          normalizedComp.balance = 0;
          changed = true;
        }

        if (!normalizedComp.status) {
          normalizedComp.status = 'active';
          changed = true;
        }

        if (!Array.isArray(normalizedComp.installedApps)) {
          normalizedComp.installedApps = ['app_settings', 'app_pos', 'app_public_space'];
          changed = true;
        }

        if (!Array.isArray(normalizedComp.branches) || normalizedComp.branches.length === 0) {
          normalizedComp.branches = [
            {
              id: `br_${compId}_main`,
              companyId: compId,
              name: 'Matriz Principal',
              address: 'Endereço Principal',
              phone: '(11) 99999-0000',
              isActive: true,
              isMain: true
            }
          ];
          changed = true;
        } else {
          // Ensure at least one branch is flagged as isMain
          const hasMain = normalizedComp.branches.some(b => b.isMain);
          if (!hasMain && normalizedComp.branches[0]) {
            normalizedComp.branches[0].isMain = true;
            changed = true;
          }
        }

        if (changed) {
          needsReSave = true;
          centralState.companies.set(compId, normalizedComp);
        }
      }

      // Schema Normalization: CompanyUsers branchIds and credentials
      for (const [compId, users] of centralState.companyUsers.entries()) {
        const updatedUsers = users.map(u => {
          let pin = u.pin;
          let password = u.password;
          let changed = false;

          if (!Array.isArray(u.branchIds)) {
            changed = true;
          }

          if (pin && !pin.startsWith('scrypt:')) {
            pin = hashPassword(pin);
            changed = true;
          }
          if (password && !password.startsWith('scrypt:')) {
            password = hashPassword(password);
            changed = true;
          }

          if (changed) {
            needsReSave = true;
            return {
              ...u,
              pin,
              password,
              branchIds: Array.isArray(u.branchIds) ? u.branchIds : [],
              status: u.status || 'active'
            };
          }
          return u;
        });
        centralState.companyUsers.set(compId, updatedUsers);
      }

      // Secure Credential Hashing & HQ Schema Normalization Migration
      if (parsed['hqAdmins']) {
        const initialAdminPwd = getProdHqAdminPassword();
        centralState.hqAdmins = (parsed['hqAdmins'] as { id: string; name: string; email: string; password?: string; passwordHash?: string; role?: 'hq_admin'; mfaEnabled?: boolean; mfaSecret?: string }[]).map(admin => {
          let pwd = admin.password || admin.passwordHash || initialAdminPwd;
          let pwdChanged = false;
          if (pwd && !pwd.startsWith('scrypt:')) {
            pwd = hashPassword(pwd);
            pwdChanged = true;
          }
          if (pwdChanged) {
            needsReSave = true;
          }
          const mfaSec = admin.mfaSecret || process.env['HQ_ADMIN_MFA_SECRET'] || crypto.randomBytes(16).toString('hex');
          return {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            password: pwd,
            role: admin.role || 'hq_admin',
            mfaEnabled: true,
            mfaSecret: mfaSec
          };
        });
      }

      const envChanged = enforceHqAdminEnvOverrides();
      if (envChanged) {
        needsReSave = true;
      }

      // Ensure all installedApps have corresponding AppEntitlement and AppInstallation for safety and backward-compatibility
      for (const [compId, comp] of centralState.companies.entries()) {
        if (comp.installedApps && Array.isArray(comp.installedApps)) {
          for (const appId of comp.installedApps) {
            const key = `${compId}:${appId}`;
            if (!centralState.appEntitlements.has(key)) {
              const appCatalog = centralState.apps.find(a => a.id === appId);
              centralState.appEntitlements.set(key, {
                id: `ent_${compId}_${appId}`,
                companyId: compId,
                appId,
                status: 'ACTIVE',
                pricingModel: appCatalog?.pricing.model || 'FREE',
                amount: appCatalog?.pricing.amount || 0,
                currency: 'BRL',
                createdAt: new Date().toISOString()
              });
              needsReSave = true;
            }
            if (!centralState.appInstallations.has(key)) {
              const appCatalog = centralState.apps.find(a => a.id === appId);
              centralState.appInstallations.set(key, {
                id: `inst_${compId}_${appId}`,
                companyId: compId,
                appId,
                installedVersion: appCatalog?.currentRelease?.version || '1.1.0',
                status: 'INSTALLED',
                installedAt: new Date().toISOString()
              });
              needsReSave = true;
            }
          }
        }
      }

      lastLoadedTimestamp = new Date().toISOString();
      console.log('Central Store: State successfully loaded and normalized from disk.');
      
      // Seed/sync relational SQLite database with loaded state
      try {
        centralDatabase.persistState(centralState);
      } catch (e) {
        console.error('Failed to sync to SQLite on load:', e);
      }

      // Save secure migrated state back to disk immediately
      if (needsReSave) {
        console.log('Central Store: Normalization changes detected. Auto-persisting normalized state to disk.');
        saveCentralState();
      }
    } catch (err) {
      storeStatus = 'DEGRADED';
      console.error('Central Store: Error loading and normalizing store:', err);
    }
  } else {
    // Initial boot without existing file: persist demo/seed state
    console.log('Central Store: Initializing fresh store and creating initial disk file.');
    saveCentralState();
    try {
      centralDatabase.persistState(centralState);
    } catch (e) {
      console.error('Failed to init SQLite on fresh store:', e);
    }
    lastLoadedTimestamp = new Date().toISOString();
  }
}

export function getCentralStoreDiagnostics(): CentralStoreDiagnostics {
  let fileSizeBytes = 0;
  try {
    if (existsSync(CENTRAL_STORE_FILE)) {
      fileSizeBytes = statSync(CENTRAL_STORE_FILE).size;
    }
  } catch (err) {
    console.error('Failed reading central store stats:', err);
  }

  let totalUsers = 0;
  let totalBranches = 0;
  for (const users of centralState.companyUsers.values()) {
    totalUsers += users.length;
  }
  for (const company of centralState.companies.values()) {
    totalBranches += (company.branches || []).length;
  }

  let totalInvoices = 0;
  for (const invs of centralState.invoices.values()) {
    totalInvoices += invs.length;
  }

  const memory = process.memoryUsage();
  const memoryUsageMb = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;

  return {
    status: storeStatus,
    filePath: CENTRAL_STORE_FILE,
    backupExists: existsSync(CENTRAL_STORE_BAK),
    fileSizeBytes,
    lastLoadedAt: lastLoadedTimestamp,
    lastSavedAt: lastSavedTimestamp,
    writeCount: totalWriteCount,
    entities: {
      tenantsCount: centralState.companies.size,
      usersCount: totalUsers,
      branchesCount: totalBranches,
      devicesCount: centralState.devices.size,
      invoicesCount: totalInvoices,
      auditLogsCount: centralState.hqAuditLogs.length,
      plansCount: centralState.plans.length,
      appsCount: centralState.apps.length,
      osReleasesCount: centralState.osReleases.length,
      productsCount: centralState.products.size,
      salesCount: centralState.sales.size,
      ordersCount: centralState.orders.size,
      customersCount: centralState.customers.size,
      financeTransactionsCount: centralState.financeTransactions.size
    },
    memoryUsageMb
  };
}

export function createCentralStoreSnapshot(note?: string): { snapshotFile: string; sizeBytes: number } {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeNote = note ? `_${note.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  const snapshotFile = join(BACKUPS_DIR, `central_store_${timestamp}${safeNote}.json`);
  
  // Make sure current in-memory state is flushed first
  saveCentralState();
  copyFileSync(CENTRAL_STORE_FILE, snapshotFile);
  const sizeBytes = statSync(snapshotFile).size;
  return { snapshotFile, sizeBytes };
}

export function compactCentralStore(): CentralStoreDiagnostics {
  // Clean up any stale telemetry (> 7 days old)
  const now = Date.now();
  const maxTelemetryAge = 7 * 24 * 60 * 60 * 1000;
  for (const [key, val] of centralState.telemetry.entries()) {
    const reportTime = new Date(val.timestamp).getTime();
    if (now - reportTime > maxTelemetryAge) {
      centralState.telemetry.delete(key);
    }
  }

  saveCentralState();
  return getCentralStoreDiagnostics();
}
