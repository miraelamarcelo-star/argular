const fs = require('fs');
let content = fs.readFileSync('src/server/routes/store.ts', 'utf8');

const regex = /const entitlementKey = `\$\{companyId\}:\$\{appId\}`;[\s\S]*?saveCentralState\(\);/m;

const replacement = `
  const result = centralDatabase.installStoreAppTransaction(companyId, deviceId, appId, appItem);

  if (!result.success) {
    res.status(500).json({ error: 'Falha ao processar instalação do aplicativo.' });
    return;
  }

  const entitlementKey = \`\${companyId}:\${appId}\`;
  const deviceInstallKey = \`\${companyId}:\${deviceId}:\${appId}\`;

  if (result.ledgerEntry) {
    company.balance -= result.ledgerEntry.amount;
    const ledger = centralState.companyLedger.get(companyId) || [];
    ledger.unshift(result.ledgerEntry);
    centralState.companyLedger.set(companyId, ledger);
  }

  centralState.appEntitlements.set(entitlementKey, result.entitlement);
  centralState.appInstallations.set(deviceInstallKey, result.installation);

  if (!company.installedApps.includes(appId)) {
    company.installedApps.push(appId);
  }

  saveCentralState(true);
`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/server/routes/store.ts', content);
