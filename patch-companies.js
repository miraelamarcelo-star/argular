const fs = require('fs');
let content = fs.readFileSync('src/server/routes/companies.ts', 'utf8');

const regex = /companiesRouter\.post\('\/companies\/:id\/invoices\/:invoiceId\/pay', requireTenantRole\(\['admin', 'manager'\]\), \(req, res\) => \{[\s\S]*?\n\}\);/m;

const replacement = `companiesRouter.post('/companies/:id/invoices/:invoiceId/pay', requireTenantRole(['admin', 'manager']), (req, res) => {
  const companyId = req.params['id'] as string;
  const invoiceId = req.params['invoiceId'] as string;
  const { paymentMethod } = req.body || {};

  const invoices = centralState.invoices.get(companyId) || [];
  const invoice = invoices.find(inv => inv.id === invoiceId);

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Fatura não encontrada.' });
    return;
  }

  const method = paymentMethod || 'PIX';
  const qrCodeString = method === 'PIX' ? \`00020101021226830014br.gov.bcb.pix2561pix.3eatcru.com.br/v2/cob/mock-qr-code5204000053039865405\${invoice.totalAmount.toFixed(2)}5802BR59113EATCRU_OS6009SAO_PAULO62070503***6304\` : undefined;

  const result = centralDatabase.createPaymentOrderTransaction(invoiceId, companyId, method, invoice.totalAmount, qrCodeString);
  
  if (!result.success) {
    res.status(result.code || 500).json({ success: false, message: result.message || 'Erro ao criar ordem de pagamento.' });
    return;
  }

  if (result.reused) {
    res.json({ success: true, paymentOrder: result.paymentOrder, reused: true });
    return;
  }

  // Sincroniza cache
  centralState.paymentOrders.set(result.paymentOrder.id, result.paymentOrder);
  invoice.status = 'PAYMENT_CREATED';
  saveCentralState(true);

  res.json({ success: true, paymentOrder: result.paymentOrder });
});`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/server/routes/companies.ts', content);
