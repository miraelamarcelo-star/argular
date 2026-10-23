const fs = require('fs');
let content = fs.readFileSync('src/server/db/central-db.ts', 'utf8');

const newMethods = `
  public saveTelemetryTransaction(report: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(\`
        INSERT INTO telemetry (id, company_id, device_id, os_version, metrics, timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          metrics = excluded.metrics, timestamp = excluded.timestamp
      \`).run(
        report.id, report.companyId, report.deviceId, report.osVersion || null,
        JSON.stringify(report.metrics || {}), report.timestamp || new Date().toISOString(), new Date().toISOString()
      );
      return { success: true };
    });
  }

  public upsertOsReleaseTransaction(release: any): any {
    if (!this.db) return { success: false };
    return this.runInTransaction(() => {
      this.db!.prepare(\`
        INSERT INTO os_releases (id, version, release_channel, release_notes, checksum, mandatory, min_os_version, published_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(
        release.id || \`rel_\${Date.now()}\`, release.version, release.releaseChannel || 'stable', release.releaseNotes || null,
        release.checksum || null, release.mandatory ? 1 : 0, release.minOsVersion || null, release.publishedAt || new Date().toISOString(), new Date().toISOString()
      );
      return { success: true };
    });
  }
`;

content = content.replace(/}\s*export const centralDatabase/, newMethods + '\n}\n\nexport const centralDatabase');
fs.writeFileSync('src/server/db/central-db.ts', content);
