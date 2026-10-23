const fs = require('fs');
let content = fs.readFileSync('src/server/routes/telemetry.ts', 'utf8');

content = content.replace(/centralState\.telemetry\.set\(telemetryKey, report\);\n/g, "centralDatabase.saveTelemetryTransaction(report);\n  centralState.telemetry.set(telemetryKey, report);\n");

content = content.replace(/centralState\.osReleases\.push\(releaseData\);\n/g, "centralDatabase.upsertOsReleaseTransaction(releaseData);\n  centralState.osReleases.push(releaseData);\n");

content = content.replace(/saveCentralState\(\);/g, "saveCentralState(true);");

fs.writeFileSync('src/server/routes/telemetry.ts', content);
