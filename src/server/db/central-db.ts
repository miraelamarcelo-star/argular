/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const DATA_DIR = join(process.cwd(), 'data');
const DB_FILE = join(DATA_DIR, 'central_platform.db');

export class CentralDatabaseEngine {
  private db: DatabaseSync | null = null;
  private isInitialized = false;
  private currentDbPath: string = DB_FILE;

  constructor(customDbPath?: string) {
    this.init(customDbPath);
  }

  public getRawDatabase(): DatabaseSync | null {
    if (!this.db) {
      this.init();
    }
    return this.db;
  }

  public close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore if already closed
      }
      this.db = null;
      this.isInitialized = false;
    }
  }

  public init(customDbPath?: string) {
    const targetPath = customDbPath || this.currentDbPath || DB_FILE;
    if (this.isInitialized && this.db && this.currentDbPath === targetPath) return;

    if (this.db) {
      this.close();
    }

    try {
      this.currentDbPath = targetPath;
      const targetDir = dirname(targetPath);
      if (targetDir && !existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      this.db = new DatabaseSync(targetPath);

      // WAL journal mode for ACID concurrency and durability
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');

      this.createTables();
      this.isInitialized = true;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Failed to initialize SQLite database:', err);
    }
  }

  private createTables() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        cnpj TEXT,
        logo_url TEXT,
        balance REAL NOT NULL DEFAULT 0,
        installed_apps TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        plan TEXT DEFAULT 'starter',
        max_terminals INTEGER DEFAULT 1,
        max_branches INTEGER DEFAULT 1,
        active_terminals INTEGER DEFAULT 0,
        channel TEXT DEFAULT 'stable',
        os_target_version TEXT,
        license_expires_at TEXT,
        branches TEXT DEFAULT '[]',
        allow_negative_stock INTEGER DEFAULT 0,
        is_demo INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS company_users (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL,
        pin TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        last_login TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hq_admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'hq_admin',
        password TEXT NOT NULL,
        mfa_enabled INTEGER NOT NULL DEFAULT 1,
        mfa_secret TEXT
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        monthly_price REAL NOT NULL,
        max_terminals INTEGER NOT NULL DEFAULT 1,
        max_branches INTEGER NOT NULL DEFAULT 1,
        description TEXT NOT NULL,
        included_apps TEXT NOT NULL DEFAULT '[]',
        features TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock REAL NOT NULL DEFAULT 0,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        total REAL NOT NULL,
        timestamp TEXT NOT NULL,
        payment_method TEXT,
        operator TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        points REAL NOT NULL DEFAULT 0,
        total_spent REAL NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'Bronze',
        created_at TEXT NOT NULL,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tables_registry (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        current_order TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS finance_transactions (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operator TEXT NOT NULL,
        reference_id TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS public_spaces (
        company_id TEXT PRIMARY KEY,
        company_slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        logo TEXT NOT NULL,
        template_id TEXT NOT NULL,
        theme_color TEXT NOT NULL,
        status TEXT NOT NULL,
        published_at TEXT,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT NOT NULL,
        hours TEXT NOT NULL,
        products TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        public_tracking_token TEXT,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        company_name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        items TEXT NOT NULL DEFAULT '[]',
        total REAL NOT NULL,
        notes TEXT,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'RECEIVED',
        channel TEXT NOT NULL DEFAULT 'MARKETPLACE',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS telemetry (
        company_id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        device_id TEXT,
        timestamp TEXT NOT NULL,
        overall_status TEXT NOT NULL,
        client_reported_status TEXT,
        central_calculated_health TEXT,
        checks TEXT NOT NULL DEFAULT '[]',
        platform TEXT NOT NULL,
        version TEXT NOT NULL,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id TEXT PRIMARY KEY,
        processed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS os_releases (
        version TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        release_date TEXT NOT NULL,
        status TEXT NOT NULL,
        changelog TEXT NOT NULL,
        min_required_by_apps TEXT
      );

      CREATE TABLE IF NOT EXISTS app_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        developer TEXT NOT NULL,
        publisher TEXT,
        category TEXT NOT NULL,
        icon TEXT NOT NULL,
        pricing TEXT NOT NULL DEFAULT '{}',
        lifecycle TEXT NOT NULL DEFAULT '{}',
        current_release TEXT,
        permissions TEXT NOT NULL DEFAULT '[]',
        capabilities TEXT NOT NULL DEFAULT '[]',
        dependencies TEXT NOT NULL DEFAULT '[]',
        is_system_app INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS billing_idempotency_log (
        key TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        processed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        os_version TEXT NOT NULL DEFAULT '1.4.3',
        fingerprint_hash TEXT,
        installation_id TEXT,
        hardware_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        registered_at TEXT NOT NULL,
        last_seen_at TEXT,
        ip_address TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        company_id TEXT NOT NULL,
        company_name TEXT,
        billing_period TEXT,
        issue_date TEXT,
        due_date TEXT NOT NULL,
        paid_at TEXT,
        status TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        items TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_entitlements (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        status TEXT NOT NULL,
        pricing_model TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BRL',
        created_at TEXT NOT NULL,
        expires_at TEXT,
        license_key TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_installations (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        device_id TEXT,
        app_id TEXT NOT NULL,
        installed_version TEXT NOT NULL,
        status TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        gateway_reference TEXT,
        qr_code TEXT,
        qr_code_copy_paste TEXT,
        status TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        expires_at TEXT,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS company_ledger (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        previous_balance REAL NOT NULL,
        new_balance REAL NOT NULL,
        description TEXT NOT NULL,
        reference_id TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hq_audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        admin_id TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target_tenant_id TEXT,
        target_tenant_name TEXT,
        details TEXT NOT NULL,
        ip_address TEXT
      );

      CREATE TABLE IF NOT EXISTS idempotency_log (
        key TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        response TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
      CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
      CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
      CREATE INDEX IF NOT EXISTS idx_finance_company ON finance_transactions(company_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_company ON company_ledger(company_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
    `);

    // Schema migrations for existing databases
    const ensureCol = (tbl: string, col: string, definition: string) => {
      try {
        const info = this.db!.prepare(`PRAGMA table_info(${tbl})`).all() as { name: string }[];
        if (info && info.length > 0 && !info.some(c => c.name === col)) {
          this.db!.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${definition}`);
        }
      } catch {
        // Ignored if table doesn't exist or column exists
      }
    };

    ensureCol('plans', 'monthly_price', "REAL NOT NULL DEFAULT 0");
    ensureCol('plans', 'included_apps', "TEXT NOT NULL DEFAULT '[]'");
    ensureCol('invoices', 'invoice_number', "TEXT");
    ensureCol('invoices', 'company_name', "TEXT");
    ensureCol('invoices', 'billing_period', "TEXT");
    ensureCol('invoices', 'issue_date', "TEXT");
    ensureCol('invoices', 'subtotal', "REAL DEFAULT 0");
    ensureCol('invoices', 'discount', "REAL DEFAULT 0");
    ensureCol('invoices', 'total_amount', "REAL NOT NULL DEFAULT 0");
    ensureCol('orders', 'public_tracking_token', "TEXT");
    ensureCol('orders', 'branch_id', "TEXT");
    ensureCol('orders', 'customer_phone', "TEXT");
    ensureCol('orders', 'customer_address', "TEXT");
    ensureCol('orders', 'notes', "TEXT");
    ensureCol('orders', 'updated_at', "TEXT");
    ensureCol('payment_orders', 'payment_method', "TEXT NOT NULL DEFAULT 'PIX'");
    ensureCol('payment_orders', 'gateway_reference', "TEXT");
    ensureCol('payment_orders', 'qr_code_copy_paste', "TEXT");
    ensureCol('payment_orders', 'confirmed_at', "TEXT");
    ensureCol('payment_orders', 'expires_at', "TEXT");
    ensureCol('devices', 'os_version', "TEXT NOT NULL DEFAULT '1.4.3'");
    ensureCol('devices', 'fingerprint_hash', "TEXT");
    ensureCol('devices', 'installation_id', "TEXT");
    ensureCol('devices', 'hardware_id', "TEXT");
    ensureCol('devices', 'last_seen_at', "TEXT");
  }

  public hasData(): boolean {
    if (!this.db) return false;
    try {
      const row = this.db.prepare('SELECT count(*) as cnt FROM companies').get() as { cnt: number } | undefined;
      return (row?.cnt ?? 0) > 0;
    } catch {
      return false;
    }
  }

  public isWebhookProcessed(eventId: string): boolean {
    if (!this.db) return false;
    try {
      const row = this.db.prepare('SELECT 1 FROM processed_webhook_events WHERE event_id = ?').get(eventId) as Record<string, unknown> | undefined;
      return !!row;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking webhook event in database:', err);
      return false;
    }
  }

  public markWebhookProcessed(eventId: string) {
    if (!this.db) return;
    try {
      this.db.prepare('INSERT OR IGNORE INTO processed_webhook_events (event_id, processed_at) VALUES (?, ?)').run(eventId, new Date().toISOString());
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error marking webhook as processed in database:', err);
      throw err;
    }
  }

  public isIdempotencyProcessed(key: string): { status: string; processedAt: string; response: unknown } | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT * FROM idempotency_log WHERE key = ?').get(key) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        status: String(row['status']),
        processedAt: String(row['processed_at']),
        response: JSON.parse(String(row['response']) || '{}')
      };
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking idempotency key in database:', err);
      return null;
    }
  }

  public saveIdempotencyEntry(key: string, entry: { status: string; processedAt: string; response: unknown }) {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO idempotency_log (key, status, processed_at, response) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          status = excluded.status,
          processed_at = excluded.processed_at,
          response = excluded.response
      `).run(key, entry.status, entry.processedAt, JSON.stringify(entry.response));
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error saving idempotency entry to database:', err);
      throw err;
    }
  }

  public isBillingIdempotencyProcessed(key: string): string | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare('SELECT invoice_id FROM billing_idempotency_log WHERE key = ?').get(key) as Record<string, unknown> | undefined;
      return row ? String(row['invoice_id']) : null;
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error checking billing idempotency key in database:', err);
      return null;
    }
  }

  public saveBillingIdempotencyEntry(key: string, invoiceId: string) {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO billing_idempotency_log (key, invoice_id, processed_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO NOTHING
      `).run(key, invoiceId, new Date().toISOString());
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error saving billing idempotency entry to database:', err);
      throw err;
    }
  }

  public persistState(state: {
    plans?: unknown[];
    hqAdmins?: unknown[];
    companies: Map<string, unknown>;
    companyUsers: Map<string, unknown[]>;
    products: Map<string, unknown>;
    sales: Map<string, unknown>;
    customers: Map<string, unknown>;
    tables: Map<string, unknown>;
    financeTransactions: Map<string, unknown>;
    publicSpaces: Map<string, unknown>;
    orders?: Map<string, unknown>;
    telemetry?: Map<string, unknown>;
    processedWebhookEvents?: Set<string>;
    osReleases?: unknown[];
    apps?: unknown[];
    billingIdempotencyLog?: Map<string, string>;
    devices: Map<string, unknown>;
    invoices: Map<string, unknown[]>;
    appEntitlements: Map<string, unknown>;
    appInstallations?: Map<string, unknown>;
    paymentOrders?: Map<string, unknown>;
    companyLedger: Map<string, unknown[]>;
    hqAuditLogs?: unknown[];
  }) {
    if (!this.db) return;

    try {
      this.db.exec('BEGIN IMMEDIATE;');

      // Plans
      if (state.plans && Array.isArray(state.plans)) {
        const plansInfo = this.db.prepare('PRAGMA table_info(plans)').all() as { name: string }[];
        const colNames = plansInfo.map(c => c.name);
        const hasPrice = colNames.includes('price');
        const hasMonthlyPrice = colNames.includes('monthly_price');
        const hasSupportLevel = colNames.includes('support_level');

        for (const rawPlan of state.plans) {
          const p = rawPlan as Record<string, unknown>;
          const mPrice = Number(p['monthlyPrice'] ?? p['price'] ?? 0);
          const cols: string[] = ['id', 'name', 'max_terminals', 'max_branches', 'description', 'features'];
          const vals: unknown[] = [
            String(p['id']),
            String(p['name'] || ''),
            Number(p['maxTerminals'] || 1),
            Number(p['maxBranches'] || 1),
            String(p['description'] || ''),
            JSON.stringify(p['features'] || [])
          ];

          if (hasMonthlyPrice) {
            cols.push('monthly_price');
            vals.push(mPrice);
          }
          if (hasPrice) {
            cols.push('price');
            vals.push(mPrice);
          }
          if (colNames.includes('included_apps')) {
            cols.push('included_apps');
            vals.push(JSON.stringify(p['includedApps'] || []));
          }
          if (hasSupportLevel) {
            cols.push('support_level');
            vals.push(String(p['supportLevel'] || 'standard'));
          }

          const placeholders = cols.map(() => '?').join(', ');
          const updateAssignments = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
          const stmt = this.db.prepare(`
            INSERT INTO plans (${cols.join(', ')}) VALUES (${placeholders})
            ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
          `);
          stmt.run(...vals);
        }
      }

      // HQ Admins
      if (state.hqAdmins && Array.isArray(state.hqAdmins)) {
        const insertAdmin = this.db.prepare(`
          INSERT INTO hq_admins (
            id, name, email, role, password, mfa_enabled, mfa_secret
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            role = excluded.role,
            password = excluded.password,
            mfa_enabled = excluded.mfa_enabled,
            mfa_secret = excluded.mfa_secret
        `);
        for (const rawAdmin of state.hqAdmins) {
          const a = rawAdmin as Record<string, unknown>;
          insertAdmin.run(
            String(a['id']),
            String(a['name'] || ''),
            String(a['email'] || ''),
            String(a['role'] || 'hq_admin'),
            String(a['password'] || ''),
            a['mfaEnabled'] !== false ? 1 : 0,
            (a['mfaSecret'] as string) || null
          );
        }
      }

      // Companies (Using safe UPSERT with ON CONFLICT to prevent DELETE CASCADE on child tables)
      const insertComp = this.db.prepare(`
        INSERT INTO companies (
          id, name, slug, cnpj, logo_url, balance, installed_apps, status,
          plan, max_terminals, max_branches, active_terminals, channel,
          os_target_version, license_expires_at, branches, allow_negative_stock, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          cnpj = excluded.cnpj,
          logo_url = excluded.logo_url,
          balance = excluded.balance,
          installed_apps = excluded.installed_apps,
          status = excluded.status,
          plan = excluded.plan,
          max_terminals = excluded.max_terminals,
          max_branches = excluded.max_branches,
          active_terminals = excluded.active_terminals,
          channel = excluded.channel,
          os_target_version = excluded.os_target_version,
          license_expires_at = excluded.license_expires_at,
          branches = excluded.branches,
          allow_negative_stock = excluded.allow_negative_stock,
          is_demo = excluded.is_demo
      `);

      for (const [id, rawComp] of state.companies.entries()) {
        const c = rawComp as Record<string, unknown>;
        insertComp.run(
          id,
          String(c['name'] || ''),
          (c['slug'] as string) || null,
          (c['cnpj'] as string) || null,
          (c['logoUrl'] as string) || null,
          Number(c['balance'] || 0),
          JSON.stringify(c['installedApps'] || []),
          String(c['status'] || 'active'),
          (c['plan'] as string) || 'starter',
          Number(c['maxTerminals'] || 1),
          Number(c['maxBranches'] || 1),
          Number(c['activeTerminals'] || 0),
          (c['channel'] as string) || 'stable',
          (c['osTargetVersion'] as string) || null,
          (c['licenseExpiresAt'] as string) || null,
          JSON.stringify(c['branches'] || []),
          c['allowNegativeStock'] ? 1 : 0,
          c['isDemo'] ? 1 : 0
        );
      }

      // Company Users (Safe UPSERT on id)
      const insertUser = this.db.prepare(`
        INSERT INTO company_users (
          id, company_id, branch_id, name, email, role, password, pin, active, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          password = excluded.password,
          pin = excluded.pin,
          active = excluded.active,
          last_login = excluded.last_login
      `);

      for (const [companyId, usersList] of state.companyUsers.entries()) {
        if (Array.isArray(usersList)) {
          for (const u of usersList) {
            const user = u as Record<string, unknown>;
            insertUser.run(
              String(user['id']),
              companyId,
              (user['branchId'] as string) || null,
              String(user['name'] || ''),
              String(user['email'] || ''),
              String(user['role'] || 'operator'),
              String(user['password'] || ''),
              (user['pin'] as string) || null,
              user['active'] !== false ? 1 : 0,
              (user['lastLogin'] as string) || null
            );
          }
        }
      }

      // Products (Safe UPSERT on id)
      const insertProduct = this.db.prepare(`
        INSERT INTO products (id, company_id, branch_id, name, price, stock)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          price = excluded.price,
          stock = excluded.stock
      `);
      for (const [id, rawProd] of state.products.entries()) {
        const p = rawProd as Record<string, unknown>;
        insertProduct.run(
          id,
          String(p['companyId'] || ''),
          (p['branchId'] as string) || null,
          String(p['name'] || ''),
          Number(p['price'] || 0),
          Number(p['stock'] || 0)
        );
      }

      // Sales (Safe UPSERT on id)
      const insertSale = this.db.prepare(`
        INSERT INTO sales (id, company_id, branch_id, items, total, timestamp, payment_method, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          items = excluded.items,
          total = excluded.total,
          timestamp = excluded.timestamp,
          payment_method = excluded.payment_method,
          operator = excluded.operator
      `);
      for (const [id, rawSale] of state.sales.entries()) {
        const s = rawSale as Record<string, unknown>;
        insertSale.run(
          id,
          String(s['companyId'] || ''),
          (s['branchId'] as string) || null,
          JSON.stringify(s['items'] || []),
          Number(s['total'] || 0),
          String(s['timestamp'] || new Date().toISOString()),
          (s['paymentMethod'] as string) || null,
          (s['operator'] as string) || null
        );
      }

      // Customers (Safe UPSERT on id)
      const insertCust = this.db.prepare(`
        INSERT INTO customers (id, company_id, branch_id, name, phone, email, points, total_spent, tier, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          phone = excluded.phone,
          email = excluded.email,
          points = excluded.points,
          total_spent = excluded.total_spent,
          tier = excluded.tier,
          created_at = excluded.created_at
      `);
      for (const [id, rawCust] of state.customers.entries()) {
        const cust = rawCust as Record<string, unknown>;
        insertCust.run(
          id,
          String(cust['companyId'] || ''),
          (cust['branchId'] as string) || null,
          String(cust['name'] || ''),
          String(cust['phone'] || ''),
          String(cust['email'] || ''),
          Number(cust['points'] || 0),
          Number(cust['totalSpent'] || 0),
          String(cust['tier'] || 'Bronze'),
          String(cust['createdAt'] || new Date().toISOString())
        );
      }

      // Tables (Safe UPSERT on id)
      const insertTable = this.db.prepare(`
        INSERT INTO tables_registry (id, company_id, branch_id, number, name, capacity, status, current_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          number = excluded.number,
          name = excluded.name,
          capacity = excluded.capacity,
          status = excluded.status,
          current_order = excluded.current_order
      `);
      for (const [id, rawTable] of state.tables.entries()) {
        const t = rawTable as Record<string, unknown>;
        insertTable.run(
          id,
          String(t['companyId'] || ''),
          (t['branchId'] as string) || null,
          Number(t['number'] || 1),
          String(t['name'] || ''),
          Number(t['capacity'] || 4),
          String(t['status'] || 'AVAILABLE'),
          t['currentOrder'] ? JSON.stringify(t['currentOrder']) : null
        );
      }

      // Finance Transactions (Safe UPSERT on id)
      const insertFinance = this.db.prepare(`
        INSERT INTO finance_transactions (
          id, company_id, branch_id, type, category, description, amount, payment_method, timestamp, operator, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          type = excluded.type,
          category = excluded.category,
          description = excluded.description,
          amount = excluded.amount,
          payment_method = excluded.payment_method,
          timestamp = excluded.timestamp,
          operator = excluded.operator,
          reference_id = excluded.reference_id
      `);
      for (const [id, rawFt] of state.financeTransactions.entries()) {
        const ft = rawFt as Record<string, unknown>;
        insertFinance.run(
          id,
          String(ft['companyId'] || ''),
          (ft['branchId'] as string) || null,
          String(ft['type'] || 'INFLOW'),
          String(ft['category'] || 'SALE'),
          String(ft['description'] || ''),
          Number(ft['amount'] || 0),
          String(ft['paymentMethod'] || 'DINHEIRO'),
          String(ft['timestamp'] || new Date().toISOString()),
          String(ft['operator'] || 'Operador'),
          (ft['referenceId'] as string) || null
        );
      }

      // Public Spaces (Safe UPSERT on company_id)
      const insertPs = this.db.prepare(`
        INSERT INTO public_spaces (
          company_id, company_slug, title, description, logo, template_id, theme_color,
          status, published_at, phone, email, address, hours, products
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
          company_slug = excluded.company_slug,
          title = excluded.title,
          description = excluded.description,
          logo = excluded.logo,
          template_id = excluded.template_id,
          theme_color = excluded.theme_color,
          status = excluded.status,
          published_at = excluded.published_at,
          phone = excluded.phone,
          email = excluded.email,
          address = excluded.address,
          hours = excluded.hours,
          products = excluded.products
      `);
      for (const [id, rawPs] of state.publicSpaces.entries()) {
        const ps = rawPs as Record<string, unknown>;
        insertPs.run(
          id,
          String(ps['companySlug'] || ''),
          String(ps['title'] || ''),
          String(ps['description'] || ''),
          String(ps['logo'] || ''),
          String(ps['templateId'] || 'default'),
          String(ps['themeColor'] || '#2563eb'),
          String(ps['status'] || 'PUBLISHED'),
          (ps['publishedAt'] as string) || null,
          String(ps['phone'] || ''),
          String(ps['email'] || ''),
          String(ps['address'] || ''),
          String(ps['hours'] || ''),
          JSON.stringify(ps['products'] || [])
        );
      }

      // Public Orders (Safe UPSERT on id)
      if (state.orders) {
        const insertOrder = this.db.prepare(`
          INSERT INTO orders (
            id, public_tracking_token, company_id, branch_id, company_name, customer_name,
            customer_phone, customer_address, items, total, notes, payment_method, status, channel, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            public_tracking_token = excluded.public_tracking_token,
            company_id = excluded.company_id,
            branch_id = excluded.branch_id,
            company_name = excluded.company_name,
            customer_name = excluded.customer_name,
            customer_phone = excluded.customer_phone,
            customer_address = excluded.customer_address,
            items = excluded.items,
            total = excluded.total,
            notes = excluded.notes,
            payment_method = excluded.payment_method,
            status = excluded.status,
            channel = excluded.channel,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `);
        for (const [id, rawOrd] of state.orders.entries()) {
          const ord = rawOrd as Record<string, unknown>;
          insertOrder.run(
            id,
            (ord['publicTrackingToken'] as string) || null,
            String(ord['companyId'] || ''),
            (ord['branchId'] as string) || null,
            String(ord['companyName'] || ''),
            String(ord['customerName'] || ''),
            (ord['customerPhone'] as string) || null,
            (ord['customerAddress'] as string) || null,
            JSON.stringify(ord['items'] || []),
            Number(ord['total'] || 0),
            (ord['notes'] as string) || null,
            String(ord['paymentMethod'] || 'PIX'),
            String(ord['status'] || 'RECEIVED'),
            String(ord['channel'] || 'MARKETPLACE'),
            String(ord['createdAt'] || new Date().toISOString()),
            (ord['updatedAt'] as string) || null
          );
        }
      }

      // Telemetry (Safe UPSERT on company_id)
      if (state.telemetry) {
        const insertTel = this.db.prepare(`
          INSERT INTO telemetry (
            company_id, company_name, device_id, timestamp, overall_status, client_reported_status,
            central_calculated_health, checks, platform, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(company_id) DO UPDATE SET
            company_name = excluded.company_name,
            device_id = excluded.device_id,
            timestamp = excluded.timestamp,
            overall_status = excluded.overall_status,
            client_reported_status = excluded.client_reported_status,
            central_calculated_health = excluded.central_calculated_health,
            checks = excluded.checks,
            platform = excluded.platform,
            version = excluded.version
        `);
        for (const [id, rawTel] of state.telemetry.entries()) {
          const tel = rawTel as Record<string, unknown>;
          insertTel.run(
            id,
            String(tel['companyName'] || ''),
            (tel['deviceId'] as string) || null,
            String(tel['timestamp'] || new Date().toISOString()),
            String(tel['overallStatus'] || 'healthy'),
            (tel['clientReportedStatus'] as string) || null,
            (tel['centralCalculatedHealth'] as string) || null,
            JSON.stringify(tel['checks'] || []),
            String(tel['platform'] || 'web'),
            String(tel['version'] || '1.0.0')
          );
        }
      }

      // Processed Webhook Events (Append-only on event_id)
      if (state.processedWebhookEvents) {
        const insertEvent = this.db.prepare(`
          INSERT INTO processed_webhook_events (event_id, processed_at)
          VALUES (?, ?)
          ON CONFLICT(event_id) DO NOTHING
        `);
        for (const eventId of state.processedWebhookEvents) {
          insertEvent.run(eventId, new Date().toISOString());
        }
      }

      // OS Releases (Safe UPSERT on version)
      if (state.osReleases && Array.isArray(state.osReleases)) {
        const insertRel = this.db.prepare(`
          INSERT INTO os_releases (
            version, channel, release_date, status, changelog, min_required_by_apps
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(version) DO UPDATE SET
            channel = excluded.channel,
            release_date = excluded.release_date,
            status = excluded.status,
            changelog = excluded.changelog,
            min_required_by_apps = excluded.min_required_by_apps
        `);
        for (const rawRel of state.osReleases) {
          const r = rawRel as Record<string, unknown>;
          insertRel.run(
            String(r['version']),
            String(r['channel'] || 'stable'),
            String(r['releaseDate'] || new Date().toISOString()),
            String(r['status'] || 'active'),
            String(r['changelog'] || ''),
            (r['minRequiredByApps'] as string) || null
          );
        }
      }

      // App Catalog (Safe UPSERT on id)
      if (state.apps && Array.isArray(state.apps)) {
        const insertApp = this.db.prepare(`
          INSERT INTO app_catalog (
            id, name, description, developer, publisher, category, icon,
            pricing, lifecycle, current_release, permissions, capabilities, dependencies, is_system_app
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            developer = excluded.developer,
            publisher = excluded.publisher,
            category = excluded.category,
            icon = excluded.icon,
            pricing = excluded.pricing,
            lifecycle = excluded.lifecycle,
            current_release = excluded.current_release,
            permissions = excluded.permissions,
            capabilities = excluded.capabilities,
            dependencies = excluded.dependencies,
            is_system_app = excluded.is_system_app
        `);
        for (const rawApp of state.apps) {
          const a = rawApp as Record<string, unknown>;
          insertApp.run(
            String(a['id']),
            String(a['name'] || ''),
            String(a['description'] || ''),
            String(a['developer'] || ''),
            (a['publisher'] as string) || null,
            String(a['category'] || 'general'),
            String(a['icon'] || 'apps'),
            JSON.stringify(a['pricing'] || {}),
            JSON.stringify(a['lifecycle'] || {}),
            a['currentRelease'] ? JSON.stringify(a['currentRelease']) : null,
            JSON.stringify(a['permissions'] || []),
            JSON.stringify(a['capabilities'] || []),
            JSON.stringify(a['dependencies'] || []),
            a['isSystemApp'] ? 1 : 0
          );
        }
      }

      // Billing Idempotency Log (Append-only on key)
      if (state.billingIdempotencyLog) {
        const insertBillLog = this.db.prepare(`
          INSERT INTO billing_idempotency_log (key, invoice_id, processed_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO NOTHING
        `);
        for (const [key, invoiceId] of state.billingIdempotencyLog.entries()) {
          insertBillLog.run(key, invoiceId, new Date().toISOString());
        }
      }

      // Devices (Safe UPSERT on device_id)
      const insertDev = this.db.prepare(`
        INSERT INTO devices (
          device_id, company_id, branch_id, name, platform, os_version, fingerprint_hash, installation_id, hardware_id, status, registered_at, last_seen_at, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
          company_id = excluded.company_id,
          branch_id = excluded.branch_id,
          name = excluded.name,
          platform = excluded.platform,
          os_version = excluded.os_version,
          fingerprint_hash = excluded.fingerprint_hash,
          installation_id = excluded.installation_id,
          hardware_id = excluded.hardware_id,
          status = excluded.status,
          registered_at = excluded.registered_at,
          last_seen_at = excluded.last_seen_at,
          ip_address = excluded.ip_address
      `);
      for (const [id, rawDev] of state.devices.entries()) {
        const d = rawDev as Record<string, unknown>;
        insertDev.run(
          id,
          String(d['companyId'] || ''),
          (d['branchId'] as string) || null,
          String(d['name'] || ''),
          String(d['platform'] || 'web'),
          String(d['osVersion'] || '1.4.3'),
          (d['fingerprintHash'] as string) || null,
          (d['installationId'] as string) || null,
          (d['hardwareId'] as string) || (d['fingerprintHash'] as string) || id,
          String(d['status'] || 'active'),
          String(d['registeredAt'] || new Date().toISOString()),
          (d['lastSeenAt'] as string) || null,
          (d['ipAddress'] as string) || null
        );
      }

      // Invoices (Safe UPSERT on id)
      const invCols = (this.db.prepare('PRAGMA table_info(invoices)').all() as { name: string }[]).map(c => c.name);
      const hasInvAmount = invCols.includes('amount');
      const hasInvTotalAmount = invCols.includes('total_amount');
      const hasInvSubtotal = invCols.includes('subtotal');
      const hasInvDiscount = invCols.includes('discount');
      const hasInvNumber = invCols.includes('invoice_number');
      const hasInvCompName = invCols.includes('company_name');
      const hasInvPeriod = invCols.includes('billing_period');
      const hasInvIssueDate = invCols.includes('issue_date');

      for (const [companyId, invList] of state.invoices.entries()) {
        if (Array.isArray(invList)) {
          for (const rawInv of invList) {
            const inv = rawInv as Record<string, unknown>;
            const totAmt = Number(inv['totalAmount'] ?? inv['amount'] ?? 0);
            const cols = ['id', 'company_id', 'due_date', 'paid_at', 'status', 'items'];
            const vals: unknown[] = [
              String(inv['id']),
              companyId,
              String(inv['dueDate'] || ''),
              (inv['paidAt'] as string) || null,
              String(inv['status'] || 'PENDING'),
              JSON.stringify(inv['items'] || [])
            ];
            if (hasInvAmount) {
              cols.push('amount');
              vals.push(totAmt);
            }
            if (hasInvTotalAmount) {
              cols.push('total_amount');
              vals.push(totAmt);
            }
            if (hasInvSubtotal) {
              cols.push('subtotal');
              vals.push(Number(inv['subtotal'] || 0));
            }
            if (hasInvDiscount) {
              cols.push('discount');
              vals.push(Number(inv['discount'] || 0));
            }
            if (hasInvNumber) {
              cols.push('invoice_number');
              vals.push((inv['invoiceNumber'] as string) || null);
            }
            if (hasInvCompName) {
              cols.push('company_name');
              vals.push((inv['companyName'] as string) || null);
            }
            if (hasInvPeriod) {
              cols.push('billing_period');
              vals.push((inv['billingPeriod'] as string) || null);
            }
            if (hasInvIssueDate) {
              cols.push('issue_date');
              vals.push((inv['issueDate'] as string) || null);
            }

            const ph = cols.map(() => '?').join(', ');
            const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
            const query = `
              INSERT INTO invoices (${cols.join(', ')}) VALUES (${ph})
              ON CONFLICT(id) DO UPDATE SET ${updates}
            `;
            this.db.prepare(query).run(...vals);
          }
        }
      }

      // App Entitlements (Safe UPSERT on id)
      const insertEnt = this.db.prepare(`
        INSERT INTO app_entitlements (
          id, company_id, app_id, status, pricing_model, amount, currency, created_at, expires_at, license_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company_id = excluded.company_id,
          app_id = excluded.app_id,
          status = excluded.status,
          pricing_model = excluded.pricing_model,
          amount = excluded.amount,
          currency = excluded.currency,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          license_key = excluded.license_key
      `);
      for (const [id, rawEnt] of state.appEntitlements.entries()) {
        const ent = rawEnt as Record<string, unknown>;
        insertEnt.run(
          id,
          String(ent['companyId'] || ''),
          String(ent['appId'] || ''),
          String(ent['status'] || 'ACTIVE'),
          String(ent['pricingModel'] || 'FREE'),
          Number(ent['amount'] || 0),
          String(ent['currency'] || 'BRL'),
          String(ent['createdAt'] || new Date().toISOString()),
          (ent['expiresAt'] as string) || null,
          (ent['licenseKey'] as string) || null
        );
      }

      // App Installations (Safe UPSERT on id)
      if (state.appInstallations) {
        const insertAppInst = this.db.prepare(`
          INSERT INTO app_installations (
            id, company_id, device_id, app_id, installed_version, status, installed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            company_id = excluded.company_id,
            device_id = excluded.device_id,
            app_id = excluded.app_id,
            installed_version = excluded.installed_version,
            status = excluded.status,
            installed_at = excluded.installed_at,
            updated_at = excluded.updated_at
        `);
        for (const [id, rawInst] of state.appInstallations.entries()) {
          const inst = rawInst as Record<string, unknown>;
          insertAppInst.run(
            id,
            String(inst['companyId'] || ''),
            (inst['deviceId'] as string) || null,
            String(inst['appId'] || ''),
            String(inst['installedVersion'] || '1.0.0'),
            String(inst['status'] || 'INSTALLED'),
            String(inst['installedAt'] || new Date().toISOString()),
            (inst['updatedAt'] as string) || null
          );
        }
      }

      // Payment Orders (Safe UPSERT on id)
      if (state.paymentOrders) {
        const poCols = (this.db.prepare('PRAGMA table_info(payment_orders)').all() as { name: string }[]).map(c => c.name);
        const hasMethod = poCols.includes('method');
        const hasPaymentMethod = poCols.includes('payment_method');
        const hasExpiresAt = poCols.includes('expires_at');
        const hasConfirmedAt = poCols.includes('confirmed_at');
        const hasGatewayRef = poCols.includes('gateway_reference');
        const hasQrCodeCopy = poCols.includes('qr_code_copy_paste');
        const hasPixCopia = poCols.includes('pix_copia_e_cola');

        for (const [id, rawPo] of state.paymentOrders.entries()) {
          const po = rawPo as Record<string, unknown>;
          const methodVal = String(po['paymentMethod'] || po['method'] || 'PIX');
          const qrCopyVal = (po['qrCodeCopyPaste'] ?? po['pixCopiaECola'] ?? null) as string | null;
          const cols = ['id', 'company_id', 'amount', 'status', 'created_at'];
          const vals: unknown[] = [
            id,
            String(po['companyId'] || ''),
            Number(po['amount'] || 0),
            String(po['status'] || 'PENDING'),
            String(po['createdAt'] || new Date().toISOString())
          ];
          if (poCols.includes('invoice_id')) {
            cols.push('invoice_id');
            vals.push((po['invoiceId'] as string) || null);
          }
          if (poCols.includes('qr_code')) {
            cols.push('qr_code');
            vals.push((po['qrCode'] as string) || null);
          }
          if (hasMethod) {
            cols.push('method');
            vals.push(methodVal);
          }
          if (hasPaymentMethod) {
            cols.push('payment_method');
            vals.push(methodVal);
          }
          if (hasQrCodeCopy) {
            cols.push('qr_code_copy_paste');
            vals.push(qrCopyVal);
          }
          if (hasPixCopia) {
            cols.push('pix_copia_e_cola');
            vals.push(qrCopyVal);
          }
          if (hasGatewayRef) {
            cols.push('gateway_reference');
            vals.push((po['gatewayReference'] as string) || null);
          }
          if (hasConfirmedAt) {
            cols.push('confirmed_at');
            vals.push((po['confirmedAt'] as string) || null);
          }
          if (hasExpiresAt) {
            cols.push('expires_at');
            vals.push(String(po['expiresAt'] || po['confirmedAt'] || new Date(Date.now() + 86400000).toISOString()));
          }

          const ph = cols.map(() => '?').join(', ');
          const updateAssignments = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
          this.db.prepare(`
            INSERT INTO payment_orders (${cols.join(', ')}) VALUES (${ph})
            ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
          `).run(...vals);
        }
      }

      // Company Ledger (Strictly Append-only on id)
      const insertLedger = this.db.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, reference_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const [companyId, entries] of state.companyLedger.entries()) {
        if (Array.isArray(entries)) {
          for (const rawEntry of entries) {
            const entry = rawEntry as Record<string, unknown>;
            insertLedger.run(
              String(entry['id']),
              companyId,
              String(entry['type'] || 'CREDIT_ADDED'),
              Number(entry['amount'] || 0),
              Number(entry['previousBalance'] || 0),
              Number(entry['newBalance'] || 0),
              String(entry['description'] || ''),
              (entry['referenceId'] as string) || null,
              String(entry['timestamp'] || new Date().toISOString())
            );
          }
        }
      }

      // HQ Audit Logs (Strictly append-only using normal INSERT with ON CONFLICT DO NOTHING to preserve historical integrity)
      if (state.hqAuditLogs && Array.isArray(state.hqAuditLogs)) {
        const insertLog = this.db.prepare(`
          INSERT INTO hq_audit_logs (
            id, timestamp, admin_id, admin_name, action, target_tenant_id, target_tenant_name, details, ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const rawLog of state.hqAuditLogs) {
          const l = rawLog as Record<string, unknown>;
          insertLog.run(
            String(l['id']),
            String(l['timestamp'] || new Date().toISOString()),
            String(l['adminId'] || ''),
            String(l['adminName'] || ''),
            String(l['action'] || ''),
            (l['targetTenantId'] as string) || null,
            (l['targetTenantName'] as string) || null,
            typeof l['details'] === 'object' ? JSON.stringify(l['details']) : String(l['details'] || ''),
            (l['ipAddress'] as string) || null
          );
        }
      }

      // Delete records removed from memory (full state reconciliation)
      const compIds = Array.from(state.companies.keys());
      if (compIds.length > 0) {
        const ph = compIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM companies WHERE id NOT IN (${ph})`).run(...compIds);
      } else {
        this.db.prepare('DELETE FROM companies').run();
      }

      const prodIds = Array.from(state.products.keys());
      if (prodIds.length > 0) {
        const ph = prodIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM products WHERE id NOT IN (${ph})`).run(...prodIds);
      } else {
        this.db.prepare('DELETE FROM products').run();
      }

      const custIds = Array.from(state.customers.keys());
      if (custIds.length > 0) {
        const ph = custIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM customers WHERE id NOT IN (${ph})`).run(...custIds);
      } else {
        this.db.prepare('DELETE FROM customers').run();
      }

      const tableIds = Array.from(state.tables.keys());
      if (tableIds.length > 0) {
        const ph = tableIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM tables_registry WHERE id NOT IN (${ph})`).run(...tableIds);
      } else {
        this.db.prepare('DELETE FROM tables_registry').run();
      }

      const salesIds = Array.from(state.sales.keys());
      if (salesIds.length > 0) {
        const ph = salesIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM sales WHERE id NOT IN (${ph})`).run(...salesIds);
      } else {
        this.db.prepare('DELETE FROM sales').run();
      }

      const finIds = Array.from(state.financeTransactions.keys());
      if (finIds.length > 0) {
        const ph = finIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM finance_transactions WHERE id NOT IN (${ph})`).run(...finIds);
      } else {
        this.db.prepare('DELETE FROM finance_transactions').run();
      }

      const psIds = Array.from(state.publicSpaces.keys());
      if (psIds.length > 0) {
        const ph = psIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM public_spaces WHERE company_id NOT IN (${ph})`).run(...psIds);
      } else {
        this.db.prepare('DELETE FROM public_spaces').run();
      }

      const devIds = Array.from(state.devices.keys());
      if (devIds.length > 0) {
        const ph = devIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM devices WHERE device_id NOT IN (${ph})`).run(...devIds);
      } else {
        this.db.prepare('DELETE FROM devices').run();
      }

      const entIds = Array.from(state.appEntitlements.keys());
      if (entIds.length > 0) {
        const ph = entIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM app_entitlements WHERE id NOT IN (${ph})`).run(...entIds);
      } else {
        this.db.prepare('DELETE FROM app_entitlements').run();
      }

      if (state.appInstallations) {
        const instIds = Array.from(state.appInstallations.keys());
        if (instIds.length > 0) {
          const ph = instIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM app_installations WHERE id NOT IN (${ph})`).run(...instIds);
        } else {
          this.db.prepare('DELETE FROM app_installations').run();
        }
      }

      if (state.paymentOrders) {
        const poIds = Array.from(state.paymentOrders.keys());
        if (poIds.length > 0) {
          const ph = poIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM payment_orders WHERE id NOT IN (${ph})`).run(...poIds);
        } else {
          this.db.prepare('DELETE FROM payment_orders').run();
        }
      }

      if (state.orders) {
        const ordIds = Array.from(state.orders.keys());
        if (ordIds.length > 0) {
          const ph = ordIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM orders WHERE id NOT IN (${ph})`).run(...ordIds);
        } else {
          this.db.prepare('DELETE FROM orders').run();
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignored if rollback fails or already rolled back
      }
      console.error('[CentralDatabaseEngine] Error persisting state to SQLite:', err);
      throw err;
    }
  }

  public loadFromDatabase(): {
    plans?: Record<string, unknown>[];
    hqAdmins?: Record<string, unknown>[];
    companies?: [string, Record<string, unknown>][];
    companyUsers?: [string, Record<string, unknown>[]][];
    products?: [string, Record<string, unknown>][];
    sales?: [string, Record<string, unknown>][];
    customers?: [string, Record<string, unknown>][];
    tables?: [string, Record<string, unknown>][];
    financeTransactions?: [string, Record<string, unknown>][];
    publicSpaces?: [string, Record<string, unknown>][];
    orders?: [string, Record<string, unknown>][];
    telemetry?: [string, Record<string, unknown>][];
    processedWebhookEvents?: string[];
    osReleases?: Record<string, unknown>[];
    apps?: Record<string, unknown>[];
    billingIdempotencyLog?: [string, string][];
    devices?: [string, Record<string, unknown>][];
    invoices?: [string, Record<string, unknown>[]][];
    appEntitlements?: [string, Record<string, unknown>][];
    appInstallations?: [string, Record<string, unknown>][];
    paymentOrders?: [string, Record<string, unknown>][];
    companyLedger?: [string, Record<string, unknown>[]][];
    hqAuditLogs?: Record<string, unknown>[];
  } | null {
    if (!this.db || !this.hasData()) return null;

    try {
      const plansRows = this.db.prepare('SELECT * FROM plans').all() as Record<string, unknown>[];
      const plans = plansRows.map(row => ({
        id: row['id'],
        name: row['name'],
        monthlyPrice: Number(row['monthly_price'] ?? row['price'] ?? 0),
        maxTerminals: Number(row['max_terminals'] || 1),
        maxBranches: Number(row['max_branches'] || 1),
        description: row['description'],
        includedApps: JSON.parse((row['included_apps'] as string) || '[]'),
        features: JSON.parse((row['features'] as string) || '[]')
      }));

      const hqAdminsRows = this.db.prepare('SELECT * FROM hq_admins').all() as Record<string, unknown>[];
      const hqAdmins = hqAdminsRows.map(row => ({
        id: row['id'],
        name: row['name'],
        email: row['email'],
        role: row['role'],
        password: row['password'],
        mfaEnabled: !!row['mfa_enabled'],
        mfaSecret: row['mfa_secret']
      }));

      const companiesRows = this.db.prepare('SELECT * FROM companies').all() as Record<string, unknown>[];
      const companies: [string, Record<string, unknown>][] = companiesRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          name: row['name'],
          slug: row['slug'],
          cnpj: row['cnpj'],
          logoUrl: row['logo_url'],
          balance: Number(row['balance']),
          installedApps: JSON.parse((row['installed_apps'] as string) || '[]'),
          status: row['status'],
          plan: row['plan'],
          maxTerminals: row['max_terminals'],
          maxBranches: row['max_branches'],
          activeTerminals: row['active_terminals'],
          channel: row['channel'],
          osTargetVersion: row['os_target_version'],
          licenseExpiresAt: row['license_expires_at'],
          branches: JSON.parse((row['branches'] as string) || '[]'),
          allowNegativeStock: !!row['allow_negative_stock'],
          isDemo: !!row['is_demo']
        }
      ]);

      const usersRows = this.db.prepare('SELECT * FROM company_users').all() as Record<string, unknown>[];
      const usersMap = new Map<string, Record<string, unknown>[]>();
      for (const row of usersRows) {
        const compId = String(row['company_id']);
        const list = usersMap.get(compId) || [];
        list.push({
          id: row['id'],
          companyId: compId,
          branchId: row['branch_id'],
          name: row['name'],
          email: row['email'],
          role: row['role'],
          password: row['password'],
          pin: row['pin'],
          active: !!row['active'],
          lastLogin: row['last_login']
        });
        usersMap.set(compId, list);
      }

      const productsRows = this.db.prepare('SELECT * FROM products').all() as Record<string, unknown>[];
      const products: [string, Record<string, unknown>][] = productsRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          name: row['name'],
          price: Number(row['price']),
          stock: Number(row['stock'])
        }
      ]);

      const salesRows = this.db.prepare('SELECT * FROM sales').all() as Record<string, unknown>[];
      const sales: [string, Record<string, unknown>][] = salesRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          items: JSON.parse((row['items'] as string) || '[]'),
          total: Number(row['total']),
          timestamp: row['timestamp'],
          paymentMethod: row['payment_method'],
          operator: row['operator']
        }
      ]);

      const customersRows = this.db.prepare('SELECT * FROM customers').all() as Record<string, unknown>[];
      const customers: [string, Record<string, unknown>][] = customersRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          name: row['name'],
          phone: row['phone'],
          email: row['email'],
          points: Number(row['points']),
          totalSpent: Number(row['total_spent']),
          tier: row['tier'],
          createdAt: row['created_at']
        }
      ]);

      const tablesRows = this.db.prepare('SELECT * FROM tables_registry').all() as Record<string, unknown>[];
      const tables: [string, Record<string, unknown>][] = tablesRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          number: Number(row['number']),
          name: row['name'],
          capacity: Number(row['capacity']),
          status: row['status'],
          currentOrder: row['current_order'] ? JSON.parse(row['current_order'] as string) : undefined
        }
      ]);

      const financeRows = this.db.prepare('SELECT * FROM finance_transactions').all() as Record<string, unknown>[];
      const financeTransactions: [string, Record<string, unknown>][] = financeRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          type: row['type'],
          category: row['category'],
          description: row['description'],
          amount: Number(row['amount']),
          paymentMethod: row['payment_method'],
          timestamp: row['timestamp'],
          operator: row['operator'],
          referenceId: row['reference_id']
        }
      ]);

      const psRows = this.db.prepare('SELECT * FROM public_spaces').all() as Record<string, unknown>[];
      const publicSpaces: [string, Record<string, unknown>][] = psRows.map(row => [
        String(row['company_id']),
        {
          companyId: row['company_id'],
          companySlug: row['company_slug'],
          title: row['title'],
          description: row['description'],
          logo: row['logo'],
          templateId: row['template_id'],
          themeColor: row['theme_color'],
          status: row['status'],
          publishedAt: row['published_at'],
          phone: row['phone'],
          email: row['email'],
          address: row['address'],
          hours: row['hours'],
          products: JSON.parse((row['products'] as string) || '[]')
        }
      ]);

      const ordersRows = this.db.prepare('SELECT * FROM orders').all() as Record<string, unknown>[];
      const orders: [string, Record<string, unknown>][] = ordersRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          publicTrackingToken: row['public_tracking_token'],
          companyId: row['company_id'],
          branchId: row['branch_id'],
          companyName: row['company_name'],
          customerName: row['customer_name'],
          customerPhone: row['customer_phone'],
          customerAddress: row['customer_address'],
          items: JSON.parse((row['items'] as string) || '[]'),
          total: Number(row['total']),
          notes: row['notes'],
          paymentMethod: row['payment_method'],
          status: row['status'],
          channel: row['channel'],
          createdAt: row['created_at'],
          updatedAt: row['updated_at']
        }
      ]);

      const telemetryRows = this.db.prepare('SELECT * FROM telemetry').all() as Record<string, unknown>[];
      const telemetry: [string, Record<string, unknown>][] = telemetryRows.map(row => [
        String(row['company_id']),
        {
          companyId: row['company_id'],
          companyName: row['company_name'],
          deviceId: row['device_id'],
          timestamp: row['timestamp'],
          overallStatus: row['overall_status'],
          clientReportedStatus: row['client_reported_status'],
          centralCalculatedHealth: row['central_calculated_health'],
          checks: JSON.parse((row['checks'] as string) || '[]'),
          platform: row['platform'],
          version: row['version']
        }
      ]);

      const processedWebhookRows = this.db.prepare('SELECT event_id FROM processed_webhook_events').all() as Record<string, unknown>[];
      const processedWebhookEvents = processedWebhookRows.map(r => String(r['event_id']));

      const osReleasesRows = this.db.prepare('SELECT * FROM os_releases').all() as Record<string, unknown>[];
      const osReleases = osReleasesRows.map(row => ({
        version: row['version'],
        channel: row['channel'],
        releaseDate: row['release_date'],
        status: row['status'],
        changelog: row['changelog'],
        minRequiredByApps: row['min_required_by_apps']
      }));

      const appsRows = this.db.prepare('SELECT * FROM app_catalog').all() as Record<string, unknown>[];
      const apps = appsRows.map(row => ({
        id: row['id'],
        name: row['name'],
        description: row['description'],
        developer: row['developer'],
        publisher: row['publisher'],
        category: row['category'],
        icon: row['icon'],
        pricing: JSON.parse((row['pricing'] as string) || '{}'),
        lifecycle: JSON.parse((row['lifecycle'] as string) || '{}'),
        currentRelease: row['current_release'] ? JSON.parse(row['current_release'] as string) : undefined,
        permissions: JSON.parse((row['permissions'] as string) || '[]'),
        capabilities: JSON.parse((row['capabilities'] as string) || '[]'),
        dependencies: JSON.parse((row['dependencies'] as string) || '[]'),
        isSystemApp: !!row['is_system_app']
      }));

      const billLogRows = this.db.prepare('SELECT * FROM billing_idempotency_log').all() as Record<string, unknown>[];
      const billingIdempotencyLog: [string, string][] = billLogRows.map(row => [
        String(row['key']),
        String(row['invoice_id'])
      ]);

      const devRows = this.db.prepare('SELECT * FROM devices').all() as Record<string, unknown>[];
      const devices: [string, Record<string, unknown>][] = devRows.map(row => [
        String(row['device_id']),
        {
          deviceId: String(row['device_id']),
          companyId: String(row['company_id']),
          branchId: (row['branch_id'] as string) || null,
          name: String(row['name'] || ''),
          platform: String(row['platform'] || 'web'),
          osVersion: String(row['os_version'] || '1.4.3'),
          fingerprintHash: (row['fingerprint_hash'] as string) || null,
          installationId: (row['installation_id'] as string) || null,
          hardwareId: (row['hardware_id'] as string) || null,
          status: String(row['status'] || 'active'),
          registeredAt: String(row['registered_at'] || new Date().toISOString()),
          lastSeenAt: (row['last_seen_at'] as string) || null,
          ipAddress: (row['ip_address'] as string) || null
        }
      ]);

      const invRows = this.db.prepare('SELECT * FROM invoices').all() as Record<string, unknown>[];
      const invoicesMap = new Map<string, Record<string, unknown>[]>();
      for (const row of invRows) {
        const compId = String(row['company_id']);
        const list = invoicesMap.get(compId) || [];
        list.push({
          id: row['id'],
          invoiceNumber: row['invoice_number'],
          companyId: compId,
          companyName: row['company_name'],
          billingPeriod: row['billing_period'],
          issueDate: row['issue_date'],
          dueDate: row['due_date'],
          paidAt: row['paid_at'],
          status: row['status'],
          subtotal: Number(row['subtotal'] || 0),
          discount: Number(row['discount'] || 0),
          totalAmount: Number(row['total_amount'] || row['amount'] || 0),
          items: JSON.parse((row['items'] as string) || '[]')
        });
        invoicesMap.set(compId, list);
      }

      const entRows = this.db.prepare('SELECT * FROM app_entitlements').all() as Record<string, unknown>[];
      const appEntitlements: [string, Record<string, unknown>][] = entRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          appId: row['app_id'],
          status: row['status'],
          pricingModel: row['pricing_model'],
          amount: Number(row['amount']),
          currency: row['currency'],
          createdAt: row['created_at'],
          expiresAt: row['expires_at'],
          licenseKey: row['license_key']
        }
      ]);

      const instRows = this.db.prepare('SELECT * FROM app_installations').all() as Record<string, unknown>[];
      const appInstallations: [string, Record<string, unknown>][] = instRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          companyId: row['company_id'],
          deviceId: row['device_id'],
          appId: row['app_id'],
          installedVersion: row['installed_version'],
          status: row['status'],
          installedAt: row['installed_at'],
          updatedAt: row['updated_at']
        }
      ]);

      const poRows = this.db.prepare('SELECT * FROM payment_orders').all() as Record<string, unknown>[];
      const paymentOrders: [string, Record<string, unknown>][] = poRows.map(row => [
        String(row['id']),
        {
          id: row['id'],
          invoiceId: row['invoice_id'],
          companyId: row['company_id'],
          paymentMethod: row['payment_method'] ?? row['method'] ?? 'PIX',
          gatewayReference: row['gateway_reference'],
          qrCode: row['qr_code'],
          qrCodeCopyPaste: row['qr_code_copy_paste'] ?? row['pix_copia_e_cola'] ?? null,
          status: row['status'],
          amount: Number(row['amount']),
          createdAt: row['created_at'],
          confirmedAt: row['confirmed_at'] ?? row['paid_at'] ?? null
        }
      ]);

      const ledgerRows = this.db.prepare('SELECT * FROM company_ledger').all() as Record<string, unknown>[];
      const ledgerMap = new Map<string, Record<string, unknown>[]>();
      for (const row of ledgerRows) {
        const compId = String(row['company_id']);
        const list = ledgerMap.get(compId) || [];
        list.push({
          id: row['id'],
          companyId: compId,
          type: row['type'],
          amount: Number(row['amount']),
          previousBalance: Number(row['previous_balance']),
          newBalance: Number(row['new_balance']),
          description: row['description'],
          referenceId: row['reference_id'],
          timestamp: row['timestamp']
        });
        ledgerMap.set(compId, list);
      }

      const auditRows = this.db.prepare('SELECT * FROM hq_audit_logs ORDER BY timestamp DESC LIMIT 500').all() as Record<string, unknown>[];
      const hqAuditLogs = auditRows.map(row => ({
        id: row['id'],
        timestamp: row['timestamp'],
        adminId: row['admin_id'],
        adminName: row['admin_name'],
        action: row['action'],
        targetTenantId: row['target_tenant_id'],
        targetTenantName: row['target_tenant_name'],
        details: typeof row['details'] === 'string' && (row['details'].startsWith('{') || row['details'].startsWith('[')) ? JSON.parse(row['details']) : row['details'],
        ipAddress: row['ip_address']
      }));

      return {
        plans,
        hqAdmins,
        companies,
        companyUsers: Array.from(usersMap.entries()),
        products,
        sales,
        customers,
        tables,
        financeTransactions,
        publicSpaces,
        orders,
        telemetry,
        processedWebhookEvents,
        osReleases,
        apps,
        billingIdempotencyLog,
        devices,
        invoices: Array.from(invoicesMap.entries()),
        appEntitlements,
        appInstallations,
        paymentOrders,
        companyLedger: Array.from(ledgerMap.entries()),
        hqAuditLogs
      };
    } catch (err) {
      console.error('[CentralDatabaseEngine] Error reading from SQLite database:', err);
      return null;
    }
  }

  public runInTransaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  public provisionCompanyTransaction(
    company: any,
    adminUser: any,
    trialDays: number,
    businessSegment: string
  ): {
    success: boolean;
    code: number;
    message: string;
    data?: {
      company: any;
      adminUser: any;
      ledgerEntry: any;
    };
  } {
    if (!this.db) {
      return { success: false, code: 500, message: 'Database not initialized' };
    }

    return this.runInTransaction(() => {
      // 1. Uniqueness check for Company Name (case-insensitive)
      const existingCompany = this.db!.prepare('SELECT 1 FROM companies WHERE LOWER(name) = ?').get(company.name.toLowerCase());
      if (existingCompany) {
        return { success: false, code: 409, message: 'Já existe uma empresa registrada com este nome corporativo.' };
      }

      // 2. Uniqueness check for Admin User Email (case-insensitive)
      const existingUser = this.db!.prepare('SELECT 1 FROM company_users WHERE LOWER(email) = ?').get(adminUser.email.toLowerCase());
      if (existingUser) {
        return { success: false, code: 409, message: 'Este e-mail já está cadastrado em um workspace corporativo.' };
      }

      // 3. Insert Company
      const companyStmt = this.db!.prepare(`
        INSERT INTO companies (
          id, name, balance, installed_apps, status, plan, max_terminals, max_branches, active_terminals, channel, os_target_version, license_expires_at, branches
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      companyStmt.run(
        company.id,
        company.name,
        company.balance,
        JSON.stringify(company.installedApps || []),
        company.status,
        company.plan,
        company.maxTerminals,
        company.maxBranches || 1,
        company.activeTerminals,
        company.channel,
        company.osTargetVersion,
        company.licenseExpiresAt,
        JSON.stringify(company.branches || [])
      );

      // 4. Insert Company User
      const userStmt = this.db!.prepare(`
        INSERT INTO company_users (
          id, company_id, branch_id, name, email, role, password, pin, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      userStmt.run(
        adminUser.id,
        adminUser.companyId,
        adminUser.branchId || null,
        adminUser.name,
        adminUser.email,
        adminUser.role,
        adminUser.password,
        adminUser.pin || null,
        adminUser.active ?? 1
      );

      // 5. Create initial Ledger entry
      const ledgerId = `ldg_${company.id}_trial`;
      const timestamp = new Date().toISOString();
      const ledgerStmt = this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const ledgerDescription = trialDays > 0
        ? `Ativação de Trial Comercial (${trialDays} dias - Plano ${company.plan.toUpperCase()} - Segmento: ${businessSegment})`
        : `Ativação de Assinatura Comercial (Plano ${company.plan.toUpperCase()} - Provisionamento Direto)`;

      ledgerStmt.run(
        ledgerId,
        company.id,
        'PLAN_CHARGE',
        0,
        0,
        0,
        ledgerDescription,
        timestamp
      );

      const ledgerEntry = {
        id: ledgerId,
        companyId: company.id,
        type: 'PLAN_CHARGE',
        amount: 0,
        previousBalance: 0,
        newBalance: 0,
        description: ledgerDescription,
        timestamp
      };

      return {
        success: true,
        code: 201,
        message: 'Workspace corporativo criado com sucesso!',
        data: {
          company,
          adminUser,
          ledgerEntry
        }
      };
    });
  }

  public insertAuditLog(log: any) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO hq_audit_logs (
        id, timestamp, admin_id, admin_name, action, target_tenant_id, target_tenant_name, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      String(log.id),
      String(log.timestamp),
      String(log.adminId || log.hqAdminId || ''),
      String(log.adminName || log.hqAdminEmail || ''),
      String(log.action || ''),
      log.targetTenantId || log.targetCompanyId || null,
      log.targetTenantName || null,
      typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || ''),
      log.ipAddress || null
    );
  }

  public confirmPaymentOrderTransaction(
    companyId: string,
    paymentOrderId: string,
    eventId?: string
  ): {
    success: boolean;
    code: number;
    message: string;
    data?: {
      company: any;
      paymentOrder: any;
      invoice: any;
      ledgerEntries: any[];
    };
  } {
    if (!this.db) {
      return { success: false, code: 500, message: 'Database not initialized' };
    }

    return this.runInTransaction(() => {
      // 1. Replay protection inside the same transaction
      if (eventId) {
        const alreadyProcessed = this.db!.prepare('SELECT 1 FROM processed_webhook_events WHERE event_id = ?').get(eventId);
        if (alreadyProcessed) {
          return { success: false, code: 409, message: 'Evento de webhook já processado anteriormente.' };
        }
        // Save webhook event to DB (locked immediately)
        this.db!.prepare('INSERT INTO processed_webhook_events (event_id, processed_at) VALUES (?, ?)')
          .run(eventId, new Date().toISOString());
      }

      // 2. Select the payment order
      const poRow = this.db!.prepare('SELECT * FROM payment_orders WHERE id = ? AND company_id = ?').get(paymentOrderId, companyId) as any;
      if (!poRow) {
        return { success: false, code: 404, message: 'Ordem de pagamento não encontrada.' };
      }

      const invoiceId = poRow.invoice_id;
      const orderAmount = Number(poRow.amount);
      const currentPoStatus = poRow.status;

      if (currentPoStatus === 'CONFIRMED') {
        return { success: false, code: 400, message: 'Esta ordem de pagamento já foi confirmada.' };
      }
      if (currentPoStatus === 'CANCELLED' || currentPoStatus === 'DUPLICATE_REJECTED') {
        return { success: false, code: 400, message: 'Esta ordem de pagamento foi cancelada ou rejeitada.' };
      }

      // 3. Select the invoice
      const invoiceRow = this.db!.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(invoiceId, companyId) as any;
      if (!invoiceRow) {
        return { success: false, code: 404, message: 'Fatura não encontrada.' };
      }

      const currentInvoiceStatus = invoiceRow.status;

      // 4. Double-credit protection
      if (currentInvoiceStatus === 'PAID') {
        // Rejects double credit atomically
        this.db!.prepare('UPDATE payment_orders SET status = ?, confirmed_at = ? WHERE id = ?')
          .run('DUPLICATE_REJECTED', new Date().toISOString(), paymentOrderId);
        return { success: false, code: 409, message: 'Fatura já está paga. Ordem rejeitada para evitar crédito duplo.' };
      }

      // 5. Select company to verify balance & license
      const companyRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!companyRow) {
        return { success: false, code: 404, message: 'Empresa não encontrada.' };
      }

      const previousBalance = Number(companyRow.balance || 0);
      const intermediateBalance = previousBalance + orderAmount;

      // 6. Confirm this payment order
      const confirmedAt = new Date().toISOString();
      this.db!.prepare('UPDATE payment_orders SET status = ?, confirmed_at = ? WHERE id = ?')
        .run('CONFIRMED', confirmedAt, paymentOrderId);

      // 7. Cancel other pending orders for the same invoice
      this.db!.prepare("UPDATE payment_orders SET status = 'CANCELLED' WHERE invoice_id = ? AND id != ? AND status = 'PENDING'")
        .run(invoiceId, paymentOrderId);

      // 8. Credit ledger entry
      const ledgerEntries: any[] = [];
      const creditLedgerId = `led_dep_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      const timestamp = new Date().toISOString();
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        creditLedgerId,
        companyId,
        'CREDIT_ADDED',
        orderAmount,
        previousBalance,
        intermediateBalance,
        `Crédito de R$ ${orderAmount.toFixed(2)} adicionado via PIX/Gateway (Ordem: ${paymentOrderId})`,
        timestamp,
        paymentOrderId
      );
      ledgerEntries.push({
        id: creditLedgerId,
        companyId,
        type: 'CREDIT_ADDED',
        amount: orderAmount,
        previousBalance,
        newBalance: intermediateBalance,
        description: `Crédito de R$ ${orderAmount.toFixed(2)} adicionado via PIX/Gateway (Ordem: ${paymentOrderId})`,
        timestamp,
        referenceId: paymentOrderId
      });

      // 9. Debit ledger entry & Invoice settlement
      const finalBalance = intermediateBalance - orderAmount;
      const debitLedgerId = `led_plan_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        debitLedgerId,
        companyId,
        'PLAN_CHARGE',
        orderAmount,
        intermediateBalance,
        finalBalance,
        `Cobrança de Fatura ${invoiceRow.invoice_number} - Liquidação automática`,
        timestamp,
        invoiceId
      );
      ledgerEntries.push({
        id: debitLedgerId,
        companyId,
        type: 'PLAN_CHARGE',
        amount: orderAmount,
        previousBalance: intermediateBalance,
        newBalance: finalBalance,
        description: `Cobrança de Fatura ${invoiceRow.invoice_number} - Liquidação automática`,
        timestamp,
        referenceId: invoiceId
      });

      // Update invoice status to PAID
      this.db!.prepare('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?')
        .run('PAID', confirmedAt, invoiceId);

      // Calculate new license expiry: base is max of current expiry or today, plus 30 days
      const currentExpiryStr = companyRow.license_expires_at;
      const baseDate = currentExpiryStr && new Date(currentExpiryStr).getTime() > Date.now()
        ? new Date(currentExpiryStr)
        : new Date();
      const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000);
      const newExpiryStr = newExpiry.toISOString().split('T')[0];

      // Update company balance and license
      this.db!.prepare("UPDATE companies SET balance = ?, license_expires_at = ?, status = 'active' WHERE id = ?")
        .run(finalBalance, newExpiryStr, companyId);

      // Fetch newly updated states to return
      const updatedCompany = {
        ...companyRow,
        balance: finalBalance,
        license_expires_at: newExpiryStr,
        status: 'active'
      };

      const updatedPo = {
        ...poRow,
        status: 'CONFIRMED',
        confirmed_at: confirmedAt
      };

      const updatedInvoice = {
        ...invoiceRow,
        status: 'PAID',
        paid_at: confirmedAt
      };

      return {
        success: true,
        code: 200,
        message: 'Pagamento confirmado e fatura liquidada com sucesso.',
        data: {
          company: updatedCompany,
          paymentOrder: updatedPo,
          invoice: updatedInvoice,
          ledgerEntries
        }
      };
    });
  }

  public runSingleCompanyBillingTransaction(
    companyId: string,
    currentPeriod: string,
    todayIso: string,
    dueDateIso: string
  ): {
    success: boolean;
    skipped: boolean;
    report?: any;
  } {
    if (!this.db) {
      return { success: false, skipped: false };
    }

    return this.runInTransaction(() => {
      const idempotencyKey = `${currentPeriod}_${companyId}`;
      const alreadyProcessed = this.db!.prepare('SELECT 1 FROM billing_idempotency_log WHERE key = ?').get(idempotencyKey);
      if (alreadyProcessed) {
        return { success: true, skipped: true };
      }

      // Select company
      const companyRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!companyRow) {
        return { success: false, skipped: false };
      }

      // Find plan details
      const planId = companyRow.plan || 'starter';
      const planRow = this.db!.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any;
      
      // Defensively parse and compute the plan price using both raw snake_case and mapped camelCase keys, avoiding NaN
      let planPrice = 99;
      if (planRow) {
        const rawVal = planRow.monthly_price ?? planRow.price ?? planRow.monthlyPrice;
        if (rawVal !== undefined && rawVal !== null) {
          const num = Number(rawVal);
          if (!isNaN(num) && isFinite(num) && num >= 0) {
            planPrice = num;
          }
        }
      } else {
        if (planId === 'pro') planPrice = 249;
        else if (planId === 'enterprise') planPrice = 599;
        else planPrice = 99;
      }
      
      const invoiceItems: any[] = [
        {
          description: `Assinatura Plano ${planId.toUpperCase()} (${currentPeriod})`,
          amount: planPrice,
          type: 'PLAN'
        }
      ];

      // Parse installed apps from companyRow
      let installedApps: string[] = [];
      const rawInstalled = companyRow.installed_apps ?? companyRow.installedApps;
      if (Array.isArray(rawInstalled)) {
        installedApps = rawInstalled;
      } else if (typeof rawInstalled === 'string') {
        try {
          const parsed = JSON.parse(rawInstalled);
          if (Array.isArray(parsed)) installedApps = parsed;
        } catch {
          installedApps = [];
        }
      }

      // Included apps from plan (supporting both snake_case and camelCase)
      let includedAppsList: string[] = [];
      if (planRow) {
        const rawApps = planRow.included_apps ?? planRow.includedApps;
        if (Array.isArray(rawApps)) {
          includedAppsList = rawApps;
        } else if (typeof rawApps === 'string') {
          try {
            const parsed = JSON.parse(rawApps);
            if (Array.isArray(parsed)) includedAppsList = parsed;
          } catch {
            includedAppsList = [];
          }
        }
      }
      const includedApps = new Set(includedAppsList);

      let extraAppsCost = 0;
      for (const appId of installedApps) {
        if (!includedApps.has(appId)) {
          const appRow = this.db!.prepare('SELECT * FROM app_catalog WHERE id = ?').get(appId) as any;
          if (appRow) {
            let appPricing: any = {};
            if (typeof appRow.pricing === 'string') {
              try {
                appPricing = JSON.parse(appRow.pricing || '{}');
              } catch {
                appPricing = {};
              }
            } else if (typeof appRow.pricing === 'object' && appRow.pricing !== null) {
              appPricing = appRow.pricing;
            }
            let appAmount = Number(appPricing.amount || 0);
            if (isNaN(appAmount) || !isFinite(appAmount) || appAmount < 0) {
              appAmount = 0;
            }
            extraAppsCost += appAmount;
            invoiceItems.push({
              description: `Módulo Adicional: ${appRow.name || appId} (${appRow.id || appId})`,
              amount: appAmount,
              type: 'EXTRA_APP'
            });
          }
        }
      }

      const totalCost = Number((planPrice + extraAppsCost).toFixed(2));
      const prevBalance = Number(companyRow.balance || 0);
      const prevStatus = companyRow.status || 'active';

      let newBalance = prevBalance;
      let invoiceStatus = 'PENDING';
      let paidAtStr: string | null = null;
      let newExpiryStr = companyRow.license_expires_at;
      let newStatus = prevStatus;
      const ledgerEntries: any[] = [];

      if (prevBalance >= totalCost) {
        newBalance = prevBalance - totalCost;
        invoiceStatus = 'PAID';
        paidAtStr = new Date().toISOString();

        // Extend license
        const currentExpiryStr = companyRow.license_expires_at;
        const baseDate = currentExpiryStr && new Date(currentExpiryStr).getTime() > Date.now()
          ? new Date(currentExpiryStr)
          : new Date();
        const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000);
        newExpiryStr = newExpiry.toISOString().split('T')[0];
        newStatus = 'active';

        // Plan charge ledger
        const ledgerId = `ldg_${companyId}_charge_${Date.now().toString().substring(6)}`;
        this.db!.prepare(`
          INSERT INTO company_ledger (
            id, company_id, type, amount, previous_balance, new_balance, description, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ledgerId,
          companyId,
          'PLAN_CHARGE',
          totalCost,
          prevBalance,
          newBalance,
          `Débito de mensalidade automática (Período: ${currentPeriod} - Plano: ${planId.toUpperCase()})`,
          paidAtStr
        );
        ledgerEntries.push({
          id: ledgerId,
          companyId,
          type: 'PLAN_CHARGE',
          amount: totalCost,
          previousBalance: prevBalance,
          newBalance,
          description: `Débito de mensalidade automática (Período: ${currentPeriod} - Plano: ${planId.toUpperCase()})`,
          timestamp: paidAtStr
        });
      } else {
        const isExpired = companyRow.license_expires_at ? new Date(companyRow.license_expires_at).getTime() < Date.now() : true;
        if (isExpired) {
          newStatus = 'suspended';
        }
      }

      // Create unique invoice id
      const invoiceId = `inv_${companyId}_${currentPeriod.replace('-', '')}`;
      const invoiceNumber = `FAT-${currentPeriod.replace('-', '')}-${companyId.substring(5, 9).toUpperCase()}`;

      // Insert invoice
      this.db!.prepare(`
        INSERT INTO invoices (
          id, invoice_number, company_id, company_name, billing_period, issue_date, due_date, paid_at, status, subtotal, discount, total_amount, items
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        invoiceNumber,
        companyId,
        companyRow.name,
        currentPeriod,
        todayIso,
        dueDateIso,
        paidAtStr,
        invoiceStatus,
        totalCost,
        0,
        totalCost,
        JSON.stringify(invoiceItems)
      );

      // Save billing idempotency
      this.db!.prepare('INSERT INTO billing_idempotency_log (key, invoice_id, processed_at) VALUES (?, ?, ?)')
        .run(idempotencyKey, invoiceId, new Date().toISOString());

      // Update company
      this.db!.prepare('UPDATE companies SET balance = ?, license_expires_at = ?, status = ? WHERE id = ?')
        .run(newBalance, newExpiryStr, newStatus, companyId);

      const updatedCompany = {
        ...companyRow,
        balance: newBalance,
        license_expires_at: newExpiryStr,
        status: newStatus
      };

      const invoiceData = {
        id: invoiceId,
        invoiceNumber,
        companyId,
        companyName: companyRow.name,
        billingPeriod: currentPeriod,
        issueDate: todayIso,
        dueDate: dueDateIso,
        paidAt: paidAtStr || undefined,
        status: invoiceStatus,
        subtotal: totalCost,
        discount: 0,
        totalAmount: totalCost,
        items: invoiceItems
      };

      return {
        success: true,
        skipped: false,
        report: {
          companyId,
          companyName: companyRow.name,
          plan: planId,
          totalCharged: totalCost,
          prevBalance,
          newBalance,
          prevStatus,
          newStatus,
          licenseExpiresAt: newExpiryStr,
          invoiceStatus,
          invoiceId,
          ledgerEntries,
          invoiceData,
          idempotencyKey
        }
      };
    });
  }

  public adjustCompanyBalanceTransaction(
    companyId: string,
    amount: number,
    description: string,
    ledgerType?: string
  ): {
    success: boolean;
    data: {
      previousBalance: number;
      newBalance: number;
      ledgerEntry: any;
    };
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT balance FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Empresa não encontrada no banco de dados');
      }
      const prevBalance = Number(company.balance || 0);
      const newBalance = prevBalance + amount;

      // Update balance
      this.db!.prepare('UPDATE companies SET balance = ? WHERE id = ?').run(newBalance, companyId);

      // Create ledger entry
      const ledgerId = `ldg_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
      const timestamp = new Date().toISOString();
      const type = ledgerType || (amount >= 0 ? 'CREDIT_ADDED' : 'PLAN_CHARGE');
      
      this.db!.prepare(`
        INSERT INTO company_ledger (
          id, company_id, type, amount, previous_balance, new_balance, description, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ledgerId,
        companyId,
        type,
        Math.abs(amount),
        prevBalance,
        newBalance,
        description,
        timestamp
      );

      const ledgerEntry = {
        id: ledgerId,
        companyId,
        type,
        amount: Math.abs(amount),
        previousBalance: prevBalance,
        newBalance,
        description,
        timestamp
      };

      return {
        success: true,
        data: {
          previousBalance: prevBalance,
          newBalance,
          ledgerEntry
        }
      };
    });
  }

  public updateTenantStatusTransaction(
    companyId: string,
    status: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId);
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }
      this.db!.prepare('UPDATE companies SET status = ? WHERE id = ?').run(status, companyId);
      return { success: true };
    });
  }

  public updateTenantEntitlementsTransaction(
    companyId: string,
    updates: {
      plan?: string;
      maxTerminals?: number;
      maxBranches?: number;
      channel?: string;
      osTargetVersion?: string;
      licenseExpiresAt?: string;
    }
  ): {
    success: boolean;
    data: any;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      const plan = updates.plan !== undefined ? updates.plan : company.plan;
      const maxTerminals = updates.maxTerminals !== undefined ? updates.maxTerminals : Number(company.max_terminals);
      const maxBranches = updates.maxBranches !== undefined ? updates.maxBranches : Number(company.max_branches);
      const channel = updates.channel !== undefined ? updates.channel : company.channel;
      const osTargetVersion = updates.osTargetVersion !== undefined ? updates.osTargetVersion : company.os_target_version;
      const licenseExpiresAt = updates.licenseExpiresAt !== undefined ? updates.licenseExpiresAt : company.license_expires_at;

      this.db!.prepare(`
        UPDATE companies SET
          plan = ?,
          max_terminals = ?,
          max_branches = ?,
          channel = ?,
          os_target_version = ?,
          license_expires_at = ?
        WHERE id = ?
      `).run(plan, maxTerminals, maxBranches, channel, osTargetVersion, licenseExpiresAt, companyId);

      // Reload updated company to return
      const updatedRow = this.db!.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      const updatedCompany = {
        id: updatedRow.id,
        name: updatedRow.name,
        balance: Number(updatedRow.balance || 0),
        installedApps: JSON.parse(updatedRow.installed_apps || '[]'),
        status: updatedRow.status,
        plan: updatedRow.plan,
        maxTerminals: Number(updatedRow.max_terminals || 10),
        maxBranches: Number(updatedRow.max_branches || 1),
        activeTerminals: Number(updatedRow.active_terminals || 0),
        channel: updatedRow.channel,
        osTargetVersion: updatedRow.os_target_version,
        licenseExpiresAt: updatedRow.license_expires_at,
        branches: JSON.parse(updatedRow.branches || '[]')
      };

      return {
        success: true,
        data: updatedCompany
      };
    });
  }

  public updateTenantAppsTransaction(
    companyId: string,
    appId: string,
    action: 'install' | 'uninstall'
  ): {
    success: boolean;
    data: string[];
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const company = this.db!.prepare('SELECT installed_apps FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        throw new Error('Tenant não encontrado no banco de dados');
      }

      let apps: string[] = JSON.parse(company.installed_apps || '[]');
      if (action === 'install') {
        if (!apps.includes(appId)) {
          apps.push(appId);
        }
      } else {
        apps = apps.filter(a => a !== appId);
      }

      this.db!.prepare('UPDATE companies SET installed_apps = ? WHERE id = ?').run(JSON.stringify(apps), companyId);
      return {
        success: true,
        data: apps
      };
    });
  }

  public registerDeviceTransaction(
    device: any
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      // Check limits
      const companyRow = this.db!.prepare('SELECT max_terminals, active_terminals FROM companies WHERE id = ?').get(device.companyId) as any;
      if (!companyRow) {
        throw new Error('Empresa não encontrada no banco de dados');
      }

      const activeTerminals = Number(companyRow.active_terminals || 0);
      const maxTerminals = Number(companyRow.max_terminals || 1);

      if (activeTerminals >= maxTerminals) {
        throw new Error(`Limite de terminais ativos atingido para este tenant (${maxTerminals} terminais). Adquira licenças adicionais no portal HQ.`);
      }

      // Check fingerprint uniqueness to avoid double registration
      const existing = this.db!.prepare('SELECT 1 FROM devices WHERE fingerprint_hash = ? AND company_id = ?').get(device.fingerprintHash, device.companyId);
      if (existing) {
        throw new Error('Este dispositivo físico já está registrado e autorizado neste inquilino.');
      }

      const deviceId = device.deviceId || device.id || `dev_${Date.now()}`;
      // Insert device
      this.db!.prepare(`
        INSERT INTO devices (
          device_id, company_id, branch_id, name, platform, os_version, fingerprint_hash, installation_id, hardware_id, status, registered_at, last_seen_at, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deviceId,
        device.companyId,
        device.branchId || null,
        device.name,
        device.platform || 'web',
        device.osVersion || '1.4.3',
        device.fingerprintHash || null,
        device.installationId || null,
        device.hardwareId || device.fingerprintHash || deviceId,
        device.status || 'active',
        device.registeredAt || device.createdAt || new Date().toISOString(),
        device.lastSeenAt || device.lastActiveAt || new Date().toISOString(),
        device.ipAddress || null
      );

      // Increment active count
      this.db!.prepare('UPDATE companies SET active_terminals = active_terminals + 1 WHERE id = ?').run(device.companyId);

      return { success: true };
    });
  }

  public updateDeviceStatusTransaction(
    companyId: string,
    deviceId: string,
    status: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const device = this.db!.prepare('SELECT status FROM devices WHERE device_id = ? AND company_id = ?').get(deviceId, companyId) as any;
      if (!device) {
        throw new Error('Terminal não encontrado no banco de dados');
      }

      const prevStatus = device.status;
      if (prevStatus === status) return { success: true };

      // Update status
      this.db!.prepare('UPDATE devices SET status = ? WHERE device_id = ? AND company_id = ?').run(status, deviceId, companyId);

      // Adjust active_terminals count on company if status transitioned to/from active
      if (prevStatus === 'active' && status !== 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = MAX(0, active_terminals - 1) WHERE id = ?').run(companyId);
      } else if (prevStatus !== 'active' && status === 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = active_terminals + 1 WHERE id = ?').run(companyId);
      }

      return { success: true };
    });
  }

  public deleteDeviceTransaction(
    companyId: string,
    deviceId: string
  ): {
    success: boolean;
  } {
    if (!this.db) throw new Error('Database not initialized');
    return this.runInTransaction(() => {
      const device = this.db!.prepare('SELECT status FROM devices WHERE device_id = ? AND company_id = ?').get(deviceId, companyId) as any;
      if (!device) {
        throw new Error('Terminal não encontrado no banco de dados');
      }

      const prevStatus = device.status;

      // Delete device
      this.db!.prepare('DELETE FROM devices WHERE device_id = ? AND company_id = ?').run(deviceId, companyId);

      // Decrement active_terminals count on company if deleted device was active
      if (prevStatus === 'active') {
        this.db!.prepare('UPDATE companies SET active_terminals = MAX(0, active_terminals - 1) WHERE id = ?').run(companyId);
      }

      return { success: true };
    });
  }

  public checkHealth(): { healthy: boolean; details: Record<string, unknown> } {
    if (!this.db) {
      return { healthy: false, details: { error: 'Database instance not initialized' } };
    }
    try {
      const ping = this.db.prepare('SELECT 1 as alive').get() as { alive?: number };
      const compCount = (this.db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count?: number })?.count ?? 0;
      const prodCount = (this.db.prepare('SELECT COUNT(*) as count FROM products').get() as { count?: number })?.count ?? 0;
      const salesCount = (this.db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count?: number })?.count ?? 0;

      return {
        healthy: ping?.alive === 1,
        details: {
          driver: 'node:sqlite',
          journalMode: 'WAL',
          companiesCount: compCount,
          productsCount: prodCount,
          salesCount: salesCount
        }
      };
    } catch (err) {
      return {
        healthy: false,
        details: { error: err instanceof Error ? err.message : String(err) }
      };
    }
  }

  public createPaymentOrderTransaction(invoiceId: string, companyId: string, paymentMethod: string, amount: number, qrCodeString?: string): any {
    if (!this.db) return { success: false, code: 500 };
    return this.runInTransaction(() => {
      // 1. Check if invoice is already PAID
      const invoice = this.db!.prepare("SELECT status FROM invoices WHERE id = ? AND company_id = ?").get(invoiceId, companyId) as any;
      if (!invoice) return { success: false, code: 404, message: 'Fatura não encontrada.' };
      if (invoice.status === 'PAID' || invoice.status === 'PAYMENT_CONFIRMED') {
        return { success: false, code: 400, message: 'Esta fatura já está paga.' };
      }
      
      // 2. Check if there is already an active PENDING payment order
      const existing = this.db!.prepare("SELECT * FROM payment_orders WHERE invoice_id = ? AND status = 'PENDING'").get(invoiceId) as any;
      if (existing) {
        return { 
          success: true, 
          reused: true, 
          paymentOrder: {
            id: existing.id,
            invoiceId: existing.invoice_id,
            companyId: existing.company_id,
            paymentMethod: existing.method || existing.payment_method,
            status: existing.status,
            amount: existing.amount,
            qrCode: existing.qr_code,
            qrCodeCopyPaste: existing.qr_code_copy_paste,
            createdAt: existing.created_at
          } 
        };
      }

      // 3. Create new payment order
      const { randomUUID } = require('node:crypto');
      const orderId = `pay_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 10)}`;
      const now = new Date().toISOString();
      const stmt = this.db!.prepare(`
        INSERT INTO payment_orders (id, company_id, amount, status, created_at, invoice_id, method, qr_code, qr_code_copy_paste)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(orderId, companyId, amount, 'PENDING', now, invoiceId, paymentMethod, qrCodeString || null, qrCodeString || null);
      
      this.db!.prepare("UPDATE invoices SET status = 'PAYMENT_CREATED' WHERE id = ?").run(invoiceId);

      return { 
        success: true, 
        reused: false, 
        paymentOrder: { 
          id: orderId, 
          invoiceId, 
          companyId, 
          paymentMethod, 
          status: 'PENDING', 
          amount, 
          qrCode: qrCodeString, 
          qrCodeCopyPaste: qrCodeString, 
          createdAt: now 
        } 
      };
    });
  }

  public installStoreAppTransaction(companyId: string, deviceId: string, appId: string, appItem: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const { randomUUID } = require('node:crypto');
      const now = new Date().toISOString();
      
      // 1. Check/Insert Entitlement
      const entitlementId = `ent_${companyId}_${appId}`;
      const existingEnt = this.db!.prepare("SELECT * FROM app_entitlements WHERE company_id = ? AND app_id = ?").get(companyId, appId);
      let entitlement;
      if (!existingEnt) {
        const entId = `ent_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO app_entitlements (id, company_id, app_id, status, pricing_model, amount, currency, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(entId, companyId, appId, 'ACTIVE', appItem.pricing.model, appItem.pricing.amount, 'BRL', now);
        entitlement = { id: entId, companyId, appId, status: 'ACTIVE', pricingModel: appItem.pricing.model, amount: appItem.pricing.amount, currency: 'BRL', createdAt: now };
      } else {
        entitlement = { id: existingEnt.id, companyId, appId, status: existingEnt.status };
      }

      // 2. Check/Insert Installation
      const existingInst = this.db!.prepare("SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?").get(companyId, deviceId, appId);
      let installation;
      if (!existingInst) {
        const instId = `inst_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO app_installations (id, company_id, device_id, app_id, installed_version, installed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(instId, companyId, deviceId, appId, appItem.currentRelease?.version || '1.0.0', now);
        installation = { id: instId, companyId, deviceId, appId, installedVersion: appItem.currentRelease?.version || '1.0.0', installedAt: now };
      } else {
        this.db!.prepare("UPDATE app_installations SET installed_version = ? WHERE id = ?").run(appItem.currentRelease?.version || '1.0.0', existingInst.id);
        installation = { id: existingInst.id, companyId, deviceId, appId, installedVersion: appItem.currentRelease?.version || '1.0.0', installedAt: existingInst.installed_at };
      }

      // 3. Billing Ledger for paid apps
      let ledgerEntry = null;
      if (!existingEnt && appItem.pricing.model === 'ONE_TIME' && appItem.pricing.amount > 0) {
        const ledId = `led_app_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
        this.db!.prepare(`
          INSERT INTO company_ledger (id, company_id, type, amount, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(ledId, companyId, 'APP_PURCHASE', appItem.pricing.amount, `Compra do aplicativo ${appItem.name}`, now);
        
        this.db!.prepare(`UPDATE companies SET balance = balance - ? WHERE id = ?`).run(appItem.pricing.amount, companyId);
        ledgerEntry = { id: ledId, companyId, type: 'APP_PURCHASE', amount: appItem.pricing.amount, description: `Compra do aplicativo ${appItem.name}`, createdAt: now };
      }

      return { success: true, entitlement, installation, ledgerEntry };
    });
  }


  public upsertAppCatalogItemTransaction(app: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM apps WHERE id = ?").get(app.id);
      if (existing) {
        this.db!.prepare(`
          UPDATE apps SET
            name = ?, description = ?, category = ?, icon = ?,
            status = ?, pricing_model = ?, pricing_amount = ?, pricing_currency = ?,
            current_version = ?, min_os_version = ?
          WHERE id = ?
        `).run(
          app.name, app.description, app.category, app.icon,
          app.status, app.pricing.model, app.pricing.amount, app.pricing.currency,
          app.currentRelease?.version || null, app.currentRelease?.minOsVersion || null,
          app.id
        );
      } else {
        this.db!.prepare(`
          INSERT INTO apps (id, name, description, category, icon, status, pricing_model, pricing_amount, pricing_currency, current_version, min_os_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          app.id, app.name, app.description, app.category, app.icon, app.status,
          app.pricing.model, app.pricing.amount, app.pricing.currency,
          app.currentRelease?.version || null, app.currentRelease?.minOsVersion || null,
          app.createdAt || new Date().toISOString()
        );
      }
      return { success: true };
    });
  }

  public upsertPlanTransaction(plan: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM plans WHERE id = ?").get(plan.id);
      if (existing) {
        this.db!.prepare(`
          UPDATE plans SET
            name = ?, max_terminals = ?, max_branches = ?, description = ?, features = ?, monthly_price = ?, included_apps = ?
          WHERE id = ?
        `).run(
          plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || []), plan.id
        );
      } else {
        this.db!.prepare(`
          INSERT INTO plans (id, name, max_terminals, max_branches, description, features, monthly_price, included_apps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          plan.id, plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || [])
        );
      }
      return { success: true };
    });
  }


  public upsertPublicSpaceTransaction(space: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT company_id FROM public_spaces WHERE company_id = ?").get(space.companyId);
      if (existing) {
        this.db!.prepare(`
          UPDATE public_spaces SET
            status = ?, slug = ?, site_name = ?, site_description = ?, theme = ?, hours = ?, products = ?, published_at = ?
          WHERE company_id = ?
        `).run(
          space.status, space.slug, space.siteName, space.siteDescription || null, JSON.stringify(space.theme || {}),
          space.hours || null, JSON.stringify(space.products || []), space.publishedAt || null, space.companyId
        );
      } else {
        this.db!.prepare(`
          INSERT INTO public_spaces (company_id, status, slug, site_name, site_description, theme, hours, products, published_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          space.companyId, space.status, space.slug, space.siteName, space.siteDescription || null, JSON.stringify(space.theme || {}),
          space.hours || null, JSON.stringify(space.products || []), space.publishedAt || null, space.createdAt || new Date().toISOString()
        );
      }
      return { success: true };
    });
  }

  public saveMarketplaceOrderTransaction(order: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        INSERT INTO orders (id, company_id, type, amount, status, details, channel, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, order.companyId, 'MARKETPLACE', order.amount || 0, order.status || 'PENDING', JSON.stringify(order), order.channel || 'MARKETPLACE', order.createdAt || new Date().toISOString()
      );
      return { success: true };
    });
  }


  public saveTelemetryTransaction(report: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        INSERT INTO telemetry (id, company_id, device_id, os_version, metrics, timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          metrics = excluded.metrics, timestamp = excluded.timestamp
      `).run(
        report.id, report.companyId, report.deviceId, report.osVersion || null,
        JSON.stringify(report.metrics || {}), report.timestamp || new Date().toISOString(), new Date().toISOString()
      );
      return { success: true };
    });
  }

  public upsertOsReleaseTransaction(release: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        INSERT INTO os_releases (id, version, release_channel, release_notes, checksum, mandatory, min_os_version, published_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        release.id || `rel_${Date.now()}`, release.version, release.releaseChannel || 'stable', release.releaseNotes || null,
        release.checksum || null, release.mandatory ? 1 : 0, release.minOsVersion || null, release.publishedAt || new Date().toISOString(), new Date().toISOString()
      );
      return { success: true };
    });
  }


  public updateStoreAppTransaction(companyId: string, deviceId: string, appId: string, version: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        UPDATE app_installations SET installed_version = ? WHERE company_id = ? AND device_id = ? AND app_id = ?
      `).run(version, companyId, deviceId, appId);
      return { success: true };
    });
  }

  public uninstallStoreAppTransaction(companyId: string, deviceId: string, appId: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(`
        DELETE FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?
      `).run(companyId, deviceId, appId);
      return { success: true };
    });
  }

}

export const centralDatabase = new CentralDatabaseEngine();
