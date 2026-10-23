const fs = require('fs');
let content = fs.readFileSync('src/server/routes/public-space.ts', 'utf8');

// replace saveCentralState() with centralDatabase.upsertPublicSpaceTransaction(space); saveCentralState(true);
content = content.replace(/centralState\.publicSpaces\.set\(companyId, updated\);\n\s*saveCentralState\(\);/g, "centralDatabase.upsertPublicSpaceTransaction(updated);\n  centralState.publicSpaces.set(companyId, updated);\n  saveCentralState(true);");

content = content.replace(/centralState\.publicSpaces\.set\(companyId, space\);\n\s*saveCentralState\(\);/g, "centralDatabase.upsertPublicSpaceTransaction(space);\n  centralState.publicSpaces.set(companyId, space);\n  saveCentralState(true);");

content = content.replace(/centralState\.orders\.set\(orderId, orderRecord\);\n\s*saveCentralState\(\);/g, "centralDatabase.saveMarketplaceOrderTransaction(orderRecord);\n  centralState.orders.set(orderId, orderRecord);\n  saveCentralState(true);");

content = content.replace(/saveCentralState\(\);/g, "saveCentralState(true);");

fs.writeFileSync('src/server/routes/public-space.ts', content);
