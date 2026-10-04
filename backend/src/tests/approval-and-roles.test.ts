import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app';
import { CustomerModel } from '../models/Customer.model';
import { InvoiceModel } from '../models/Invoice.model';
import { PaymentModel } from '../models/Payment.model';
import { ApprovalQueueModel } from '../models/ApprovalQueue.model';

/**
 * Regression tests for:
 *  - business rules on `invoiceSubtotal` firing when an invoice is created
 *  - invoices held for approval appearing in the Approval Queue
 *  - the front-line `sales` role being allowed the stock/expense/return actions meant for it
 *  - concurrent refunds of one payment applying only once
 */
async function run() {
  // Transactions (stock adjustments) need a replica set.
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  try {
    const app = createApp();
    const admin = request.agent(app);
    await admin
      .post('/api/v1/auth/register')
      .send({ name: 'Owner', email: 'owner@test.local', password: 'password123', organizationName: 'Rules Store', businessType: 'retail' })
      .expect(201);

    const customerRes = await admin.post('/api/v1/customers').send({ name: 'Big Buyer', email: 'buyer@test.local' }).expect(201);
    const customerId = customerRes.body.data._id;

    // 1. A subtotal rule requiring approval fires on create, and the invoice reaches the queue.
    await admin
      .post('/api/v1/dynamic/rules')
      .send({
        ruleName: 'Large invoices need approval',
        event: 'beforeInvoiceCalculate',
        condition: { field: 'invoiceSubtotal', operator: 'greater_than', value: 10000 },
        action: { type: 'require_approval', value: true, message: 'Invoice above 10,000 needs a manager' },
      })
      .expect(201);

    const small = await admin
      .post('/api/v1/invoices')
      .send({ customerId, status: 'sent', items: [{ description: 'Small order', quantity: 1, unitPrice: 500 }] })
      .expect(201);
    assert.equal(small.body.data.status, 'sent', 'invoice under the threshold is not held');

    const large = await admin
      .post('/api/v1/invoices')
      .send({ customerId, status: 'sent', items: [{ description: 'Bulk order', quantity: 10, unitPrice: 2000 }] })
      .expect(201);
    assert.equal(large.body.data.status, 'pending_approval', 'invoiceSubtotal rule fires on create');
    console.log('✅ invoiceSubtotal rule holds a large invoice for approval');

    const queue = await admin.get('/api/v1/approvals').expect(200);
    const entry = queue.body.data.find((item: any) => String(item.entityId) === large.body.data._id);
    assert.ok(entry, 'held invoice appears in the approval queue');
    assert.equal(entry.reason, 'Invoice above 10,000 needs a manager');

    const before = await CustomerModel.findById(customerId).lean();
    await admin.post(`/api/v1/approvals/${entry._id}/approve`).send({}).expect(200);
    const approved = await admin.get(`/api/v1/invoices/${large.body.data._id}`).expect(200);
    assert.equal(approved.body.data.status, 'approved');
    const after = await CustomerModel.findById(customerId).lean();
    assert.equal(after!.outstandingBalance - before!.outstandingBalance, large.body.data.amountDue, 'approval adds the receivable');
    console.log('✅ Held invoice is queued and approving it makes it a receivable');

    // Moving a held invoice on directly closes its queue entry.
    const held = await admin
      .post('/api/v1/invoices')
      .send({ customerId, items: [{ description: 'Another bulk order', quantity: 20, unitPrice: 1000 }] })
      .expect(201);
    assert.equal(held.body.data.status, 'pending_approval');
    await admin.delete(`/api/v1/invoices/${held.body.data._id}`).expect(200);
    const pending = await admin.get('/api/v1/approvals').expect(200);
    assert.ok(!pending.body.data.some((item: any) => String(item.entityId) === held.body.data._id), 'cancelled invoice leaves the queue');
    console.log('✅ Cancelling a held invoice closes its approval request');

    // A failed queue write rolls the held invoice back instead of stranding it.
    const invoicesBefore = await InvoiceModel.countDocuments({});
    const originalCreate = ApprovalQueueModel.create.bind(ApprovalQueueModel);
    (ApprovalQueueModel as any).create = async () => { throw Object.assign(new Error('simulated queue failure'), { statusCode: 500 }); };
    await admin
      .post('/api/v1/invoices')
      .send({ customerId, items: [{ description: 'Doomed bulk order', quantity: 20, unitPrice: 1000 }] })
      .expect(500);
    (ApprovalQueueModel as any).create = originalCreate;
    assert.equal(await InvoiceModel.countDocuments({}), invoicesBefore, 'invoice rolled back with its queue entry');
    console.log('✅ Invoice and approval request are written atomically');

    // 2. The sales role can do the front-line actions guarded for it; viewers still cannot.
    const org = await admin.get('/api/v1/organizations/profile').expect(200);
    const modules = Array.from(new Set([...(org.body.data.enabledModules || []), 'inventory', 'expenses', 'returns']));
    await admin.patch('/api/v1/organizations/settings').send({ enabledModules: modules }).expect(200);
    const product = await admin.post('/api/v1/products').send({ name: 'Rice 1kg', sku: 'RICE1', unitPrice: 60 }).expect(201);
    await admin.post('/api/v1/users').send({ name: 'Counter', email: 'sales@test.local', password: 'salespass1', role: 'sales' }).expect(201);
    await admin.post('/api/v1/users').send({ name: 'Auditor', email: 'viewer@test.local', password: 'viewerpass1', role: 'viewer' }).expect(201);

    const sales = request.agent(app);
    await sales.post('/api/v1/auth/login').send({ email: 'sales@test.local', password: 'salespass1' }).expect(200);
    await sales
      .post('/api/v1/inventory/adjust')
      .send({ productId: product.body.data._id, type: 'CORRECTION', quantityChange: 5, notes: 'Count' })
      .expect(200);
    await sales.post('/api/v1/expenses').send({ category: 'Supplies', amount: 50, description: 'Carry bags' }).expect(201);

    const viewer = request.agent(app);
    await viewer.post('/api/v1/auth/login').send({ email: 'viewer@test.local', password: 'viewerpass1' }).expect(200);
    await viewer.post('/api/v1/expenses').send({ category: 'Supplies', amount: 50, description: 'Carry bags' }).expect(403);
    console.log('✅ Sales staff can adjust stock and log expenses; viewers cannot');

    // 3. Concurrent full refunds of one payment apply exactly once.
    const payment = await admin
      .post('/api/v1/payments')
      .send({ invoiceId: small.body.data._id, amount: 500, paymentMethod: 'cash' })
      .expect(201);
    const paymentId = payment.body.data.payment._id;
    const balanceBefore = (await CustomerModel.findById(customerId).lean())!.outstandingBalance;
    const results = await Promise.all([
      admin.post(`/api/v1/payments/${paymentId}/refund`).send({ reason: 'dup click 1' }),
      admin.post(`/api/v1/payments/${paymentId}/refund`).send({ reason: 'dup click 2' }),
      admin.post(`/api/v1/payments/${paymentId}/refund`).send({ reason: 'dup click 3' }),
    ]);
    const succeeded = results.filter((r) => r.status === 200).length;
    assert.equal(succeeded, 1, `exactly one refund succeeds (statuses: ${results.map((r) => r.status).join(',')})`);
    const balanceAfter = (await CustomerModel.findById(customerId).lean())!.outstandingBalance;
    assert.equal(balanceAfter - balanceBefore, 500, 'customer balance re-opened once');
    const refunded = await admin.get(`/api/v1/payments?invoiceId=${small.body.data._id}`).expect(200);
    assert.equal(refunded.body.data[0].refundedAmount, 500);
    assert.equal(refunded.body.data[0].status, 'refunded');
    assert.equal((refunded.body.data[0].notes.match(/Refunded ₹500/g) || []).length, 1, 'refund note recorded once');
    console.log('✅ Concurrent refunds of one payment apply once');

    // A failure after the claim rolls the refund back.
    const second = await admin.post('/api/v1/invoices').send({ customerId, status: 'sent', items: [{ description: 'Second order', quantity: 1, unitPrice: 300 }] }).expect(201);
    const pay2 = await admin.post('/api/v1/payments').send({ invoiceId: second.body.data._id, amount: 300, paymentMethod: 'cash' }).expect(201);
    const originalUpdateOne = CustomerModel.updateOne.bind(CustomerModel);
    (CustomerModel as any).updateOne = () => { throw Object.assign(new Error('simulated balance failure'), { statusCode: 500 }); };
    const failed = await admin.post(`/api/v1/payments/${pay2.body.data.payment._id}/refund`).send({ reason: 'simulated' });
    assert.equal(failed.status, 500, JSON.stringify(failed.body));
    (CustomerModel as any).updateOne = originalUpdateOne;
    const untouched = await PaymentModel.findById(pay2.body.data.payment._id).lean();
    assert.equal(untouched!.refundedAmount, 0, 'payment claim rolled back');
    assert.equal(untouched!.status, 'completed');
    const invoiceAfter = await InvoiceModel.findById(second.body.data._id).lean();
    assert.equal(invoiceAfter!.status, 'paid', 'invoice unchanged');
    console.log('✅ Refund claim, invoice and balance are written atomically');

    console.log('\nAPPROVAL/ROLE/REFUND TESTS PASSED');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
