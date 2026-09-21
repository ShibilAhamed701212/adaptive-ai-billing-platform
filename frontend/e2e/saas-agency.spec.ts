import { test, expect } from '@playwright/test';

async function login(page: any, email: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button:has-text("Sign In to Workspace")');
  await expect(page.locator('text=AdaptiveBilling')).toBeVisible({ timeout: 10000 });
}

test('SaaS plan and subscription screens load real seeded records', async ({ page }) => {
  await login(page, 'admin@saas.test');
  await page.click('button:has-text("Plans")');
  await expect(page.locator('h1')).toContainText('Pricing Plans');
  await expect(page.locator('text=Starter')).toBeVisible();
  await page.click('button:has-text("Subscriptions")');
  await expect(page.locator('h1')).toContainText('Subscriptions');
  await expect(page.locator('text=Tech Corp 1')).toBeVisible();
});

test('Agency project, timesheet, and retainer screens load real seeded records', async ({ page }) => {
  await login(page, 'admin@agency.test');
  await page.click('button:has-text("Projects")');
  await expect(page.locator('h1')).toContainText('Projects');
  await expect(page.locator('text=Website Redesign 1')).toBeVisible();
  await page.click('button:has-text("Timesheets")');
  await expect(page.locator('h1')).toContainText('Timesheets');
  await expect(page.locator('text=UX Wireframing')).toBeVisible();
  await page.click('button:has-text("Retainers")');
  await expect(page.locator('h1')).toContainText('Retainers');
});
