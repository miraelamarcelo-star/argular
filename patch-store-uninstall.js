const fs = require('fs');
let content = fs.readFileSync('src/server/routes/store.ts', 'utf8');

content = content.replace(/const removedLegacy = centralState\.appInstallations\.delete\(legacyInstallKey\);/m, "const removedLegacy = centralState.appInstallations.delete(legacyInstallKey);\n  centralDatabase.uninstallStoreAppTransaction(companyId, deviceId, appId);");

fs.writeFileSync('src/server/routes/store.ts', content);
