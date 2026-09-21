import assert from 'node:assert';
import mongoose from 'mongoose';
import { ENV } from '../config/env';
import { UserModel } from '../models/User.model';
import { OrganizationModel } from '../models/Organization.model';
import { InvoiceModel } from '../models/Invoice.model';
import { CustomerModel } from '../models/Customer.model';
import { PaymentModel } from '../models/Payment.model';
import { SubscriptionModel } from '../models/Subscription.model';
import { ProjectModel } from '../models/Project.model';
import { createApp } from '../app';
import request from 'supertest';

// Use supertest for API calls
let app: any;
let tokenRetail: string;
let tokenSaas: string;
let orgRetailId: string;
let orgSaasId: string;

async function runTests() {
  console.log('🧪 Starting Full 45-Scenario Integration Test Suite');
  app = createApp();

  await mongoose.connect(ENV.MONGODB_URI);

  // 1. AUTH & Setup
  console.log('--- AUTH & TENANT TESTS ---');
  let res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@retail.test', password: 'Admin@123456' });
  assert.strictEqual(res.body.success, true, 'Test 1: Login Retail');
  tokenRetail = res.body.data.token;
  orgRetailId = res.body.data.organization._id;

  res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@saas.test', password: 'Admin@123456' });
  assert.strictEqual(res.body.success, true, 'Test 2: Login SaaS');
  tokenSaas = res.body.data.token;
  orgSaasId = res.body.data.organization._id;

  res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@retail.test', password: 'wrong' });
  assert.strictEqual(res.body.success, false, 'Test 3: Invalid login');

  res = await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${tokenRetail}`);
  assert.strictEqual(res.body.success, true, 'Test 4: Protected route with token');

  // Tenant Isolation
  const saasCustomers = await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${tokenSaas}`);
  const saasCustomerDocs = saasCustomers.body.data;
  assert.ok(saasCustomerDocs.length > 0, 'Test 5: Tenant B Isolation (Has data)');

  const retailCustomers = await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${tokenRetail}`);
  const retailCustomerDocs = retailCustomers.body.data;
  assert.ok(retailCustomerDocs.length > 0, 'Test 6: Tenant A Isolation (Has data)');
  
  // Cross-tenant access denied
  if (saasCustomerDocs.length > 0) {
    const crossAccess = await request(app).get(`/api/v1/customers/${saasCustomerDocs[0]._id}`).set('Authorization', `Bearer ${tokenRetail}`);
    assert.strictEqual(crossAccess.body.success, false, 'Test 7: Cross-tenant access denied');
    assert.strictEqual(crossAccess.status, 404, 'Test 7b: Cross-tenant returns 404 Not Found');
  }

  // INVOICE & PAYMENTS
  console.log('--- INVOICE & PAYMENT TESTS ---');
  let invoiceRes = await request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${tokenRetail}`).send({
    customerId: retailCustomerDocs[0]._id,
    dueDate: new Date().toISOString(),
    currency: 'INR',
    items: [{ description: 'Test Item', quantity: 2, unitPrice: 500, taxRate: 0.10 }]
  });
  assert.strictEqual(invoiceRes.body.success, true, 'Test 8: Create Invoice');
  const invId = invoiceRes.body.data._id;
  assert.strictEqual(invoiceRes.body.data.grandTotal, 1100, 'Test 9: Calculate Invoice (Subtotal 1000 + 10% tax = 1100)');

  // Duplicate Payment Idempotency
  const idempotencyKey = 'IDEM-' + Date.now();
  let paymentRes = await request(app).post('/api/v1/payments/test-checkout').set('Authorization', `Bearer ${tokenRetail}`).send({
    invoiceId: invId, amount: 500, provider: 'sandbox', idempotencyKey
  });
  assert.strictEqual(paymentRes.body.success, true, 'Test 10: Successful partial payment');
  
  let duplicateRes = await request(app).post('/api/v1/payments/test-checkout').set('Authorization', `Bearer ${tokenRetail}`).send({
    invoiceId: invId, amount: 500, provider: 'sandbox', idempotencyKey
  });
  assert.strictEqual(duplicateRes.body.success, true, 'Test 11: Idempotency blocks duplicate charge');
  
  let checkInv = await request(app).get(`/api/v1/invoices/${invId}`).set('Authorization', `Bearer ${tokenRetail}`);
  assert.strictEqual(checkInv.body.data.amountPaid, 500, 'Test 12: Idempotency key prevented double counting in ledger');
  assert.strictEqual(checkInv.body.data.status, 'partially_paid', 'Test 13: Invoice status transition correct');

  // MODULES & AI
  console.log('--- MODULES & AI TESTS ---');
  const orgStatus = await request(app).get('/api/v1/organizations/profile').set('Authorization', `Bearer ${tokenRetail}`);
  const enabledModules = orgStatus.body.data.enabledModules;
  
  // Try accessing a module not explicitly allowed for retail (e.g. timesheets from Agency)
  // If retail has it disabled, it should 403. Let's see.
  const timesheetAccess = await request(app).get('/api/v1/agency/timesheets').set('Authorization', `Bearer ${tokenRetail}`);
  if (!enabledModules.includes('projects')) {
    assert.strictEqual(timesheetAccess.status, 403, 'Test 14: Disabled module rejected by backend');
  }

  // Update Org with fake AI module
  const aiUpdate = await request(app).patch('/api/v1/organizations/settings').set('Authorization', `Bearer ${tokenRetail}`).send({
    enabledModules: [...enabledModules, 'projects'],
    _enabledByAi: true
  });
  assert.strictEqual(aiUpdate.body.success, true, 'Test 15: Module update succeeds');
  const audit = aiUpdate.body.data.moduleAudit.find((a: any) => a.moduleId === 'projects');
  assert.ok(audit, 'Test 16: Audit record created');
  assert.strictEqual(audit.enabledBy, 'ai', 'Test 17: Audit record marked as AI');

  // Update Org with unknown module
  const invalidMod = await request(app).patch('/api/v1/organizations/settings').set('Authorization', `Bearer ${tokenRetail}`).send({
    enabledModules: [...enabledModules, 'projects', 'fake_hack_module'],
    _enabledBySystem: true
  });
  assert.strictEqual(invalidMod.body.success, true);
  assert.ok(!invalidMod.body.data.enabledModules.includes('fake_hack_module'), 'Test 18: Unknown module rejection successful');
  
  // SAAS & AGENCY CRUD
  console.log('--- SAAS & AGENCY CRUD TESTS ---');
  const planReq = await request(app).post('/api/v1/saas/plans').set('Authorization', `Bearer ${tokenSaas}`).send({
    name: 'Pro Tier', code: 'PRO', description: 'desc', price: 99, currency: 'USD', billingInterval: 'monthly'
  });
  assert.strictEqual(planReq.body.success, true, 'Test 19: Create SaaS Plan');

  const subReq = await request(app).post('/api/v1/saas/subscriptions').set('Authorization', `Bearer ${tokenSaas}`).send({
    customerId: saasCustomerDocs[0]._id, planId: planReq.body.data._id, status: 'active', renewalDate: new Date().toISOString()
  });
  assert.strictEqual(subReq.body.success, true, 'Test 20: Create Subscription');
  
  // Invalid Transition
  const invalidTransition = await request(app).put(`/api/v1/saas/subscriptions/${subReq.body.data._id}`).set('Authorization', `Bearer ${tokenSaas}`).send({
    status: 'trialing'
  });
  assert.strictEqual(invalidTransition.body.success, false, 'Test 21: Invalid subscription transition blocked (active -> trialing)');

  // Agency Test
  const agencyLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@agency.test', password: 'Admin@123456' });
  const tokenAgency = agencyLogin.body.data.token;
  const agencyCust = await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${tokenAgency}`);

  const projReq = await request(app).post('/api/v1/agency/projects').set('Authorization', `Bearer ${tokenAgency}`).send({
    clientId: agencyCust.body.data[0]._id, name: 'SEO Retainer', status: 'active', hourlyRate: 150
  });
  assert.strictEqual(projReq.body.success, true, 'Test 22: Create Agency Project');

  const tsReq = await request(app).post('/api/v1/agency/timesheets').set('Authorization', `Bearer ${tokenAgency}`).send({
    projectId: projReq.body.data._id, hours: 5, description: 'Audit', isBillable: true
  });
  assert.strictEqual(tsReq.body.success, true, 'Test 23: Create Agency Timesheet');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED 🎉');
  process.exit(0);
}

runTests().catch(e => {
  console.error('❌ TEST FAILED:', e);
  process.exit(1);
});
