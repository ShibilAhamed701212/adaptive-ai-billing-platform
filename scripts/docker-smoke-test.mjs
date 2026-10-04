#!/usr/bin/env node
// Smoke test for a running production container (default http://localhost:10000).
// Creates a throwaway retail organization and exercises the SPA, auth and the
// transaction-backed flows: stock adjustment, POS checkout, invoice + payment + refund.
// Usage: node scripts/docker-smoke-test.mjs [baseUrl]
const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:10000';
const run = Date.now();
let cookie = '';
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie?.startsWith('billing_session=')) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function main() {
  console.log(`Smoke testing ${BASE}`);

  const health = await api('GET', '/health');
  check('health reports a connected database', health.status === 200 && health.body?.database === 'connected', `HTTP ${health.status}`);

  for (const path of ['/', '/login', '/pos']) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    check(`SPA served at ${path}`, res.status === 200 && html.includes('<div id="root">'), `HTTP ${res.status}`);
  }

  const reg = await api('POST', '/auth/register', {
    name: 'Smoke Owner',
    email: `smoke-${run}@example.test`,
    password: 'smoke-password-123',
    organizationName: `Smoke Store ${run}`,
    businessType: 'retail',
  });
  check('register organization (session cookie set)', reg.status === 201 && cookie.length > 0, `HTTP ${reg.status}`);
  check('production never seeds demo accounts', (await api('POST', '/auth/login', { email: 'admin@retail.test', password: 'Admin@123456' })).status === 401);
  // The demo-login probe above did not replace our session (401 sets no cookie).

  const product = await api('POST', '/products', { name: 'Smoke Rice 1kg', sku: `SMK-${run}`, unitPrice: 60, taxRate: 0, manageInventory: true });
  check('create product', product.status === 201, `HTTP ${product.status}`);
  const productId = product.body?.data?._id;

  const adjust = await api('POST', '/inventory/adjust', { productId, type: 'CORRECTION', quantityChange: 20, notes: 'Smoke stock' });
  check('stock adjustment (transaction)', adjust.status === 200, `HTTP ${adjust.status} ${adjust.body?.error?.message || ''}`);

  const sale = await api('POST', '/pos/checkout', {
    items: [{ productId, quantity: 3, unitPrice: 60 }],
    splitPayments: [{ method: 'cash', amount: 180 }],
    clientTransactionId: `smoke-${run}`,
  });
  check('POS checkout (transaction)', sale.status === 201 || sale.status === 200, `HTTP ${sale.status} ${sale.body?.error?.message || ''}`);
  const afterSale = await api('GET', `/products/${productId}`);
  check('checkout deducted stock 20 -> 17', afterSale.body?.data?.stockQuantity === 17, `stock=${afterSale.body?.data?.stockQuantity}`);

  const customer = await api('POST', '/customers', { name: 'Smoke Customer', email: `buyer-${run}@example.test` });
  const invoice = await api('POST', '/invoices', {
    customerId: customer.body?.data?._id,
    status: 'sent',
    items: [{ description: 'Smoke service', quantity: 1, unitPrice: 500 }],
  });
  check('create sent invoice (transaction)', invoice.status === 201 && invoice.body?.data?.status === 'sent', `HTTP ${invoice.status}`);

  const payment = await api('POST', '/payments', { invoiceId: invoice.body?.data?._id, amount: 500, paymentMethod: 'cash' });
  check('record payment', payment.status === 201 && payment.body?.data?.invoice?.status === 'paid', `HTTP ${payment.status}`);

  const refund = await api('POST', `/payments/${payment.body?.data?.payment?._id}/refund`, { reason: 'smoke test' });
  check('refund payment (transaction)', refund.status === 200 && refund.body?.data?.payment?.status === 'refunded', `HTTP ${refund.status} ${refund.body?.error?.message || ''}`);

  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});
