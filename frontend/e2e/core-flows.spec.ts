import { test, expect, Page } from '@playwright/test';

// Core money paths against the seeded demo tenants (development backend).
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button:has-text("Sign In to Workspace")');
  await expect(page.locator('text=AdaptiveBilling')).toBeVisible({ timeout: 10000 });
}

test('Invoice lifecycle: create, issue, pay in full', async ({ page }) => {
  await login(page, 'admin@retail.test');
  await page.goto('/invoices/create');

  const customerSelect = page.locator('select').filter({ has: page.locator('option', { hasText: '-- Choose Customer --' }) });
  await customerSelect.selectOption({ index: 1 });
  const productSelect = page.locator('select').filter({ has: page.locator('option', { hasText: '-- Custom Line Description --' }) }).first();
  await productSelect.selectOption({ index: 1 });

  await page.click('button:has-text("Finalize & Issue Invoice")');
  await expect(page).toHaveURL(/\/invoices\/[a-f0-9]{24}$/, { timeout: 10000 });
  const invoiceId = page.url().split('/').pop()!;

  await page.click('button:has-text("Record Payment")');
  await page.click('button:has-text("Confirm Payment")');
  await expect(page.locator('button:has-text("Record Payment")')).toHaveCount(0, { timeout: 10000 });

  const res = await page.request.get(`/api/v1/invoices/${invoiceId}`);
  const invoice = (await res.json()).data;
  expect(invoice.status).toBe('paid');
  expect(invoice.amountDue).toBe(0);
});

test('POS sale completes and decrements stock', async ({ page }) => {
  await login(page, 'admin@retail.test');
  const before = (await (await page.request.get('/api/v1/products?search=Digestive')).json()).data[0];

  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto('/pos');
  await page.click(`text=${before.name}`);
  await page.locator('button', { hasText: 'Checkout' }).last().click();
  await page.click('button:has-text("Complete Sale")');
  // Any alert() here means checkout failed; surface its text in the failure.
  await expect.poll(async () => dialogs.join(' | ') || (await page.locator('text=RETAIL RECEIPT').isVisible() ? 'receipt' : ''), { timeout: 10000 }).toBe('receipt');
  // Walk-in by default: the sale must not be booked to a customer nobody selected.
  await expect(page.locator('text=Walk-in').first()).toBeVisible();

  const after = (await (await page.request.get(`/api/v1/products/${before._id}`)).json()).data;
  expect(after.stockQuantity).toBe(before.stockQuantity - 1);
});

test('Forgot password screen accepts a request', async ({ page }) => {
  await page.goto('/login');
  await page.click('button:has-text("Forgot password?")');
  await page.fill('input[type="email"]', 'admin@general.test');
  await page.click('button:has-text("Send reset link")');
  await expect(page.locator('text=a reset link is on its way')).toBeVisible();
});

test('Phone layout: navigation drawer opens and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, 'admin@retail.test');
  await page.click('button[aria-label="Open navigation menu"]');
  await page.locator('aside').getByRole('button', { name: /^Invoices/ }).click();
  await expect(page.locator('h1')).toContainText('Invoicing Studio');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
