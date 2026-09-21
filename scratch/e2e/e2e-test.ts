import { chromium, expect } from '@playwright/test';

async function runTest() {
  console.log('Starting E2E Tests...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const timestamp = Date.now();
    const email = 'testuser_' + timestamp + '@example.com';
    const password = 'password123';

    console.log('1. Registering new organization and user...');
    await page.goto('http://localhost:5173/register');
    await page.fill('input[placeholder="e.g. Apex Global Logistics"]', 'Auto Test Org ' + timestamp);
    await page.fill('input[placeholder="Sarah Chen"]', 'Auto Tester');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.selectOption('select', 'retail');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/onboarding', { timeout: 10000 });
    console.log('2. Successfully logged in and on Onboarding page.');
    
    // Fill Onboarding or Skip
    await page.click('button:has-text("Skip for now")');
    
    // It should navigate to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('3. Onboarding skipped. Dashboard loaded.');

    console.log('4. Navigating to Team page to add a user...');
    await page.goto('http://localhost:5173/team');
    await expect(page.locator('h1').first()).toContainText('Team');
    
    console.log('5. Navigating to Invoices page...');
    await page.goto('http://localhost:5173/invoices');
    await expect(page.locator('h1').first()).toContainText('Invoic');

    console.log('Navigating to Create Invoice...');
    await page.goto('http://localhost:5173/invoices/create');
    await expect(page.locator('h1').first()).toContainText('Invoice');
    
    console.log('Invoice creation UI loaded and responsive.');

    console.log('✅ ALL TESTS PASSED!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTest();
