import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app';
import { CustomerModel } from '../models/Customer.model';

/**
 * Regression tests for:
 *  - apply_discount / add_surcharge rule actions changing what the invoice charges
 *  - editing a draft not re-applying its line discounts as an invoice discount
 *  - rules re-running on draft edits without compounding
 *  - a draft edited past an approval threshold being held instead of sent
 */
async function run() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  try {
    const app = createApp();
    const admin = request.agent(app);
    await admin
      .post('/api/v1/auth/register')
      .send({ name: 'Owner', email: 'owner@rules.local', password: 'password123', organizationName: 'Pricing Store', businessType: 'retail' })
      .expect(201);
    const customer = await admin.post('/api/v1/customers').send({ name: 'Client', email: 'client@rules.local' }).expect(201);
    const customerId = customer.body.data._id;

    // 1. Editing a draft keeps its line discount once.
    const draft = await admin
      .post('/api/v1/invoices')
      .send({ customerId, items: [{ description: 'Design', quantity: 1, unitPrice: 100, discountPercentage: 10 }] })
      .expect(201);
    assert.equal(draft.body.data.grandTotal, 90);
    const edited = await admin.patch(`/api/v1/invoices/${draft.body.data._id}`).send({ notes: 'Updated notes' }).expect(200);
    assert.equal(edited.body.data.grandTotal, 90, 'line discount is not applied a second time');
    assert.equal(edited.body.data.discountTotal, 10);
    console.log('✅ Editing a draft does not discount it twice');

    // 2. Discount and surcharge rules change the charged amount.
    await admin
      .post('/api/v1/dynamic/rules')
      .send({
        ruleName: 'Volume discount',
        event: 'beforeInvoiceCalculate',
        condition: { field: 'invoiceSubtotal', operator: 'greater_than', value: 1000 },
        action: { type: 'apply_discount', value: 10, message: '10% off above 1,000' },
      })
      .expect(201);
    await admin
      .post('/api/v1/dynamic/rules')
      .send({
        ruleName: 'Rush fee',
        event: 'beforeInvoiceCalculate',
        condition: { field: 'itemCount', operator: 'greater_than', value: 2 },
        action: { type: 'add_surcharge', value: 50, message: 'Rush handling' },
      })
      .expect(201);

    const preview = await admin
      .post('/api/v1/invoices/preview')
      .send({ customerId, items: [{ description: 'Build', quantity: 1, unitPrice: 2000 }] })
      .expect(200);
    assert.equal(preview.body.data.totals.grandTotal, 1800, 'preview shows the rule discount');

    const discounted = await admin
      .post('/api/v1/invoices')
      .send({ customerId, items: [{ description: 'Build', quantity: 1, unitPrice: 2000 }] })
      .expect(201);
    assert.equal(discounted.body.data.grandTotal, 1800, '10% rule discount applied');
    assert.equal(discounted.body.data.discountTotal, 200);

    const reEdited = await admin.patch(`/api/v1/invoices/${discounted.body.data._id}`).send({ notes: 'Again' }).expect(200);
    assert.equal(reEdited.body.data.grandTotal, 1800, 'rule discount does not compound on edit');

    const surcharged = await admin
      .post('/api/v1/invoices')
      .send({
        customerId,
        items: [
          { description: 'A', quantity: 1, unitPrice: 100 },
          { description: 'B', quantity: 1, unitPrice: 100 },
          { description: 'C', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(201);
    assert.equal(surcharged.body.data.grandTotal, 350, 'surcharge line added');
    assert.equal(surcharged.body.data.items.length, 4);

    // Dropping to two lines removes the surcharge on edit; it never duplicates.
    const reduced = await admin
      .patch(`/api/v1/invoices/${surcharged.body.data._id}`)
      .send({ items: surcharged.body.data.items.slice(0, 2).map((i: any) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) })
      .expect(200);
    assert.equal(reduced.body.data.grandTotal, 200);
    assert.equal(reduced.body.data.items.length, 2);
    const resaved = await admin.patch(`/api/v1/invoices/${surcharged.body.data._id}`).send({ items: surcharged.body.data.items }).expect(200);
    assert.equal(resaved.body.data.items.length, 4, 'resending the surcharge line does not duplicate it');
    assert.equal(resaved.body.data.grandTotal, 350);
    console.log('✅ Discount and surcharge rules are charged, and re-pricing a draft never compounds them');

    // 3. A draft edited past an approval threshold is held when sent.
    await admin
      .post('/api/v1/dynamic/rules')
      .send({
        ruleName: 'Large needs approval',
        event: 'beforeInvoiceCalculate',
        condition: { field: 'invoiceSubtotal', operator: 'greater_than', value: 50000 },
        action: { type: 'require_approval', value: true, message: 'Over 50,000' },
      })
      .expect(201);
    const before = (await CustomerModel.findById(customerId).lean())!.outstandingBalance;
    await admin
      .patch(`/api/v1/invoices/${draft.body.data._id}`)
      .send({ items: [{ description: 'Design', quantity: 1, unitPrice: 90000 }] })
      .expect(200);
    const sent = await admin.patch(`/api/v1/invoices/${draft.body.data._id}/status`).send({ status: 'sent' }).expect(200);
    assert.equal(sent.body.data.status, 'pending_approval', 'held instead of sent');
    const queue = await admin.get('/api/v1/approvals').expect(200);
    assert.ok(queue.body.data.some((e: any) => String(e.entityId) === draft.body.data._id && e.reason === 'Over 50,000'));
    assert.equal((await CustomerModel.findById(customerId).lean())!.outstandingBalance, before, 'no receivable until approved');
    console.log('✅ A draft edited past an approval rule is held for approval when sent');

    console.log('\nRULE PRICING TESTS PASSED');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
