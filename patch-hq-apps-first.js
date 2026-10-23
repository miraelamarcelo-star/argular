const fs = require('fs');
let content = fs.readFileSync('src/server/routes/hq-apps.ts', 'utf8');
// Fix the first one
content = content.replace(/centralDatabase\.upsertAppCatalogItemTransaction\(centralState\.apps\[idx\]\);\s*saveCentralState\(true\);\s*res\.status\(201\)/, 'saveCentralState(true);\n  res.status(201)');
fs.writeFileSync('src/server/routes/hq-apps.ts', content);
