import { test, expect } from '@playwright/test';

test.describe('Adaptive AI Billing & POS Platform E2E Tests', () => {

  test('1. Authentication Flow: Cashier/Admin Login', async ({ page }) => {
    await page.goto('/');
    
    // Check login header
    await expect(page.locator('h1')).toContainText('Welcome Back');

    // Fill in demo credentials
    await page.fill('input[type="email"]', 'admin@nexuscloud.io');
    await page.fill('input[type="password"]', 'Admin@123456');

    // Submit form
    await page.click('button:has-text("Sign In to Workspace")');

    // Should load the dashboard
    await expect(page.locator('text=Executive Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('2. Navigation & POS Interface', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@nexuscloud.io');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In to Workspace")');

    // Wait for AppLayout to load
    await expect(page.locator('text=AdaptiveBilling')).toBeVisible({ timeout: 10000 });

    // Click on Point of Sale (POS) from Sidebar
    await page.click('button:has-text("Point of Sale (POS)")');

    // Verify POS container mounts
    await expect(page.locator('text=Point of Sale')).toBeVisible({ timeout: 10000 });
  });

  test('3. Operational Pages Navigation Test', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@nexuscloud.io');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Sign In to Workspace")');

    await expect(page.locator('text=AdaptiveBilling')).toBeVisible({ timeout: 10000 });

    // Navigate to Customers
    await page.click('button:has-text("Customers")');
    await expect(page.locator('text=Customer Accounts')).toBeVisible({ timeout: 10000 });

    // Navigate to Financial Reports
    await page.click('button:has-text("Financial Reports")');
    await expect(page.locator('text=Financial Intelligence & Reports')).toBeVisible({ timeout: 10000 });

    // Navigate to Inventory & Stock
    await page.click('button:has-text("Inventory & Stock")');
    await expect(page.locator('text=Inventory Management')).toBeVisible({ timeout: 10000 });
  });

});
