const fs = require('fs');
let content = fs.readFileSync('src/server/db/central-db.ts', 'utf8');

const newMethods = `
  public updateStoreAppTransaction(companyId: string, deviceId: string, appId: string, version: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(\`
        UPDATE app_installations SET installed_version = ? WHERE company_id = ? AND device_id = ? AND app_id = ?
      \`).run(version, companyId, deviceId, appId);
      return { success: true };
    });
  }

  public uninstallStoreAppTransaction(companyId: string, deviceId: string, appId: string): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(\`
        DELETE FROM app_installations WHERE company_id = ? AND device_id = ? AND app_id = ?
      \`).run(companyId, deviceId, appId);
      return { success: true };
    });
  }
`;

content = content.replace(/}\s*export const centralDatabase/, newMethods + '\n}\n\nexport const centralDatabase');
fs.writeFileSync('src/server/db/central-db.ts', content);
