const fs = require('fs');

let content = fs.readFileSync('src/server/db/central-db.ts', 'utf8');

const newMethods = `
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
      const orderId = \`pay_\${Date.now()}_\${randomUUID().replace(/-/g, '').substring(0, 10)}\`;
      const now = new Date().toISOString();
      const stmt = this.db!.prepare(\`
        INSERT INTO payment_orders (id, company_id, amount, status, created_at, invoice_id, method, qr_code, qr_code_copy_paste)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`);
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
      const entitlementId = \`ent_\${companyId}_\${appId}\`;
      const existingEnt = this.db!.prepare("SELECT * FROM app_entitlements WHERE company_id = ? AND app_id = ?").get(companyId, appId);
      let entitlement;
      if (!existingEnt) {
        const entId = \`ent_\${Date.now()}_\${randomUUID().replace(/-/g, '').substring(0, 8)}\`;
        this.db!.prepare(\`
          INSERT INTO app_entitlements (id, company_id, app_id, status, pricing_model, amount, currency, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(entId, companyId, appId, 'ACTIVE', appItem.pricing.model, appItem.pricing.amount, 'BRL', now);
        entitlement = { id: entId, companyId, appId, status: 'ACTIVE', pricingModel: appItem.pricing.model, amount: appItem.pricing.amount, currency: 'BRL', createdAt: now };
      } else {
        entitlement = { id: existingEnt.id, companyId, appId, status: existingEnt.status };
      }

      // 2. Check/Insert Installation
      const existingInst = this.db!.prepare("SELECT * FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?").get(companyId, deviceId, appId);
      let installation;
      if (!existingInst) {
        const instId = \`inst_\${Date.now()}_\${randomUUID().replace(/-/g, '').substring(0, 8)}\`;
        this.db!.prepare(\`
          INSERT INTO app_installations (id, company_id, device_id, app_id, installed_version, installed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        \`).run(instId, companyId, deviceId, appId, appItem.currentRelease?.version || '1.0.0', now);
        installation = { id: instId, companyId, deviceId, appId, installedVersion: appItem.currentRelease?.version || '1.0.0', installedAt: now };
      } else {
        this.db!.prepare("UPDATE app_installations SET installed_version = ? WHERE id = ?").run(appItem.currentRelease?.version || '1.0.0', existingInst.id);
        installation = { id: existingInst.id, companyId, deviceId, appId, installedVersion: appItem.currentRelease?.version || '1.0.0', installedAt: existingInst.installed_at };
      }

      // 3. Billing Ledger for paid apps
      let ledgerEntry = null;
      if (!existingEnt && appItem.pricing.model === 'ONE_TIME' && appItem.pricing.amount > 0) {
        const ledId = \`led_app_\${randomUUID().replace(/-/g, '').substring(0, 8)}\`;
        this.db!.prepare(\`
          INSERT INTO company_ledger (id, company_id, type, amount, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        \`).run(ledId, companyId, 'APP_PURCHASE', appItem.pricing.amount, \`Compra do aplicativo \${appItem.name}\`, now);
        
        this.db!.prepare(\`UPDATE companies SET balance = balance - ? WHERE id = ?\`).run(appItem.pricing.amount, companyId);
        ledgerEntry = { id: ledId, companyId, type: 'APP_PURCHASE', amount: appItem.pricing.amount, description: \`Compra do aplicativo \${appItem.name}\`, createdAt: now };
      }

      return { success: true, entitlement, installation, ledgerEntry };
    });
  }
`;

content = content.replace(/}\s*export const centralDatabase/, newMethods + '\n}\n\nexport const centralDatabase');

fs.writeFileSync('src/server/db/central-db.ts', content);
