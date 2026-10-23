const fs = require('fs');
let content = fs.readFileSync('src/server/routes/store.ts', 'utf8');

content = content.replace(/centralState\.appInstallations\.set\(deviceInstallKey, installation\);\n\n\s*saveCentralState\(\);/m, "centralDatabase.updateStoreAppTransaction(companyId, deviceId, appId, appItem.currentRelease.version);\n  centralState.appInstallations.set(deviceInstallKey, installation);\n  saveCentralState(true);");

content = content.replace(/saveCentralState\(\);/g, "saveCentralState(true);");

fs.writeFileSync('src/server/routes/store.ts', content);
