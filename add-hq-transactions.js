const fs = require('fs');
let content = fs.readFileSync('src/server/db/central-db.ts', 'utf8');

const newMethods = `
  public upsertAppCatalogItemTransaction(app: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT id FROM apps WHERE id = ?").get(app.id);
      if (existing) {
        this.db!.prepare(\`
          UPDATE apps SET
            name = ?, description = ?, category = ?, icon = ?,
            status = ?, pricing_model = ?, pricing_amount = ?, pricing_currency = ?,
            current_version = ?, min_os_version = ?
          WHERE id = ?
        \`).run(
          app.name, app.description, app.category, app.icon,
          app.status, app.pricing.model, app.pricing.amount, app.pricing.currency,
          app.currentRelease?.version || null, app.currentRelease?.minOsVersion || null,
          app.id
        );
      } else {
        this.db!.prepare(\`
          INSERT INTO apps (id, name, description, category, icon, status, pricing_model, pricing_amount, pricing_currency, current_version, min_os_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(
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
        this.db!.prepare(\`
          UPDATE plans SET
            name = ?, max_terminals = ?, max_branches = ?, description = ?, features = ?, monthly_price = ?, included_apps = ?
          WHERE id = ?
        \`).run(
          plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || []), plan.id
        );
      } else {
        this.db!.prepare(\`
          INSERT INTO plans (id, name, max_terminals, max_branches, description, features, monthly_price, included_apps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(
          plan.id, plan.name, plan.maxTerminals, plan.maxBranches, plan.description, JSON.stringify(plan.features), plan.monthlyPrice || plan.price || 0, JSON.stringify(plan.includedApps || [])
        );
      }
      return { success: true };
    });
  }
`;

content = content.replace(/}\s*export const centralDatabase/, newMethods + '\n}\n\nexport const centralDatabase');
fs.writeFileSync('src/server/db/central-db.ts', content);
