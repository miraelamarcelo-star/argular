const fs = require('fs');
let content = fs.readFileSync('src/server/db/central-db.ts', 'utf8');

const newMethods = `
  public upsertPublicSpaceTransaction(space: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      const existing = this.db!.prepare("SELECT company_id FROM public_spaces WHERE company_id = ?").get(space.companyId);
      if (existing) {
        this.db!.prepare(\`
          UPDATE public_spaces SET
            status = ?, slug = ?, site_name = ?, site_description = ?, theme = ?, hours = ?, products = ?, published_at = ?
          WHERE company_id = ?
        \`).run(
          space.status, space.slug, space.siteName, space.siteDescription || null, JSON.stringify(space.theme || {}),
          space.hours || null, JSON.stringify(space.products || []), space.publishedAt || null, space.companyId
        );
      } else {
        this.db!.prepare(\`
          INSERT INTO public_spaces (company_id, status, slug, site_name, site_description, theme, hours, products, published_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(
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
      this.db!.prepare(\`
        INSERT INTO orders (id, company_id, type, amount, status, details, channel, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(
        order.id, order.companyId, 'MARKETPLACE', order.amount || 0, order.status || 'PENDING', JSON.stringify(order), order.channel || 'MARKETPLACE', order.createdAt || new Date().toISOString()
      );
      return { success: true };
    });
  }
`;

content = content.replace(/}\s*export const centralDatabase/, newMethods + '\n}\n\nexport const centralDatabase');
fs.writeFileSync('src/server/db/central-db.ts', content);
