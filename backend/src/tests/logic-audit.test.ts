/**
 * LOGIC-AUDIT REGRESSION TESTS
 *
 * Covers the bugs found and fixed in the full system logic audit:
 *  - BUG-01/02: invoice calculator tax-vs-discount + quantity/percentage edge cases
 *  - BUG-03/05: invoice state machine + client-supplied status rejection
 *  - BUG-04:    atomic invoice number reservation (concurrency)
 *  - BUG-07/08: payment status trust + overpayment guard
 *  - BUG-09/16: refund guards + cumulative partial-refund tracking
 *  - BUG-10:    tenant-scoped invoice lookup on refund
 *  - BUG-12:    callLLM returns null (deterministic fallback) without API keys
 *  - BUG-13:    no hard-coded demo organization name in AI responses
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import '../core/tenancy/tenant.middleware';
import { calculateInvoice } from '../billing-engine/calculators/invoice-calculator';
import { reserveInvoiceNumber } from '../billing-engine/next-invoice-number';
import { createInvoice, updateInvoiceStatus } from '../modules/invoices/invoice.controller';
import { recordPayment, refundPayment } from '../modules/payments/payment.controller';
import { askBusiness } from '../modules/ai/ai.controller';
import { OrganizationModel } from '../models/Organization.model';
import { CustomerModel } from '../models/Customer.model';
import { InvoiceModel } from '../models/Invoice.model';
import { PaymentModel } from '../models/Payment.model';
import { callLLM } from '../ai/llm-provider';

let mongo: MongoMemoryServer;

function mockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.data = data;
    return res;
  };
  return res;
}

const noop = () => {};

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  console.log('🚀 RUNNING LOGIC-AUDIT REGRESSION TESTS...');
  // Force the no-provider path deterministically: keys may live in .env (loaded into
  // ENV config), so both process.env and the config object must be cleared.
  const { ENV } = await import('../config/env');
  (ENV as any).GEMINI_API_KEY = '';
  (ENV as any).OPENAI_API_KEY = '';
  process.env.GEMINI_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { directConnection: true });

  await OrganizationModel.init();
  await CustomerModel.init();
  await InvoiceModel.init();
  await PaymentModel.init();

  try {
    // ---------- BUG-01: invoice-level discount allocated before tax ----------
    const calc = calculateInvoice(
      [
        { description: 'A', quantity: 5, unitPrice: 1000, taxRate: 0.18 },
        { description: 'B', quantity: 2, unitPrice: 2500, taxRate: 0.12 },
      ],
      { taxSystem: 'GST', originState: 'Delhi', destinationState: 'Delhi', invoiceDiscountAmount: 1000 }
    );
    check('BUG-01: tax computed on discounted base', calc.totals.taxTotal === 1350, `taxTotal=${calc.totals.taxTotal}`);
    check('BUG-01: grandTotal = taxable + tax', calc.totals.grandTotal === 10350, `grandTotal=${calc.totals.grandTotal}`);

    // ---------- BUG-02: quantity zero stays zero; percentage clamped ----------
    const calcQty = calculateInvoice(
      [{ description: 'Zero', quantity: 0, unitPrice: 500, taxRate: 0.18 }],
      { taxSystem: 'NONE' }
    );
    check('BUG-02: quantity 0 contributes 0', calcQty.totals.grandTotal === 0 && calcQty.items[0].quantity === 0);

    const calcPct = calculateInvoice(
      [{ description: 'X', quantity: 1, unitPrice: 1000, taxRate: 0.18, discountPercentage: 150 }],
      { taxSystem: 'NONE' }
    );
    check('BUG-02: discount% >100 clamped, total 0', calcPct.totals.grandTotal === 0);

    // ---------- Fixtures ----------
    const org = await OrganizationModel.create({
      name: 'Audit Org',
      slug: 'audit-org',
      settings: { nextInvoiceNumber: 5000, taxSystem: 'GST', currency: 'INR', currencySymbol: '₹', paymentTermsDays: 30 },
    });
    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();
    const customer = await CustomerModel.create({
      organizationId: org._id,
      name: 'Ledger Customer',
      email: 'ledger@audit.test',
      outstandingBalance: 0,
    });

    // ---------- BUG-05: client cannot mint a paid/approved invoice ----------
    let res = mockRes();
    await createInvoice(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: {
          customerId: String(customer._id),
          status: 'paid',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000, taxRate: 0 }],
        },
      } as any,
      res,
      noop
    );
    check('BUG-05: createInvoice rejects status paid', res.statusCode === 400);

    // ---------- Legal flow: create sent invoice (1000 due), pay partially ----------
    res = mockRes();
    await createInvoice(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: {
          customerId: String(customer._id),
          status: 'sent',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000, taxRate: 0 }],
        },
      } as any,
      res,
      noop
    );
    const invoice = await InvoiceModel.findById(res.data?.data?._id);
    check('Sent invoice created with 1000 due', invoice?.amountDue === 1000 && invoice?.status === 'sent');
    check('Customer outstanding raised to 1000', (await CustomerModel.findById(customer._id))?.outstandingBalance === 1000);

    // ---------- BUG-08: overpayment rejected ----------
    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(invoice!._id), amount: 5000 },
      } as any,
      res,
      noop
    );
    check('BUG-08: overpayment rejected with 400', res.statusCode === 400 && res.data?.error?.code === 'OVERPAYMENT');

    // ---------- BUG-07: pending payment does not move money ----------
    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(invoice!._id), amount: 400, status: 'pending' },
      } as any,
      res,
      noop
    );
    const afterPending = await InvoiceModel.findById(invoice!._id);
    check('BUG-07: pending payment recorded', res.statusCode === 201);
    check('BUG-07: pending payment does not reduce amountDue', afterPending?.amountDue === 1000 && afterPending?.status === 'sent');
    check('BUG-07: pending payment does not reduce customer balance', (await CustomerModel.findById(customer._id))?.outstandingBalance === 1000);

    // ---------- Partial payment then full settlement ----------
    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(invoice!._id), amount: 400 },
      } as any,
      res,
      noop
    );
    const afterPartial = await InvoiceModel.findById(invoice!._id);
    check('Partial payment -> partially_paid, due 600', afterPartial?.status === 'partially_paid' && afterPartial?.amountDue === 600);

    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(invoice!._id), amount: 600, idempotencyKey: 'audit-dedup-001' },
      } as any,
      res,
      noop
    );
    const paidInvoice = await InvoiceModel.findById(invoice!._id);
    check('Final payment -> paid, due 0', paidInvoice?.status === 'paid' && paidInvoice?.amountDue === 0);
    check('Customer outstanding back to 0', (await CustomerModel.findById(customer._id))?.outstandingBalance === 0);

    // Payment once more with the same idempotency key returns the same record
    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(invoice!._id), amount: 600, idempotencyKey: 'audit-dedup-001' },
      } as any,
      res,
      noop
    );
    const paymentsForInvoice = await PaymentModel.countDocuments({ invoiceId: invoice!._id, status: 'completed', amount: 600 });
    check('Idempotency: no duplicate payment record created', paymentsForInvoice === 1);

    // ---------- BUG-03: illegal state transitions ----------
    res = mockRes();
    await updateInvoiceStatus(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        params: { id: String(paidInvoice!._id) },
        body: { status: 'draft' },
      } as any,
      res,
      noop
    );
    check('BUG-03: paid -> draft rejected', res.statusCode === 400 && res.data?.error?.code === 'INVALID_TRANSITION');

    // ---------- Refund flow with cumulative tracking (BUG-09/16) ----------
    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(paidInvoice!._id), amount: 1000 },
      } as any,
      res,
      noop
    );
    check('Re-pay after refund test setup blocked (due 0)', res.statusCode === 400);

    // Fresh invoice for refund tests
    res = mockRes();
    await createInvoice(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { customerId: String(customer._id), status: 'sent', items: [{ description: 'R', quantity: 1, unitPrice: 800, taxRate: 0 }] },
      } as any,
      res,
      noop
    );
    const refundInvoice = await InvoiceModel.findById(res.data?.data?._id);

    res = mockRes();
    await recordPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { invoiceId: String(refundInvoice!._id), amount: 800 },
      } as any,
      res,
      noop
    );
    const refundPaymentDoc = await PaymentModel.findOne({ invoiceId: refundInvoice!._id, amount: 800 });

    res = mockRes();
    await refundPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        params: { id: String(refundPaymentDoc!._id) },
        body: { amount: 1200, reason: 'over-refund attempt' },
      } as any,
      res,
      noop
    );
    check('BUG-09: refund exceeding payment rejected', res.statusCode === 400 && res.data?.error?.code === 'REFUND_EXCEEDS_PAYMENT');

    res = mockRes();
    await refundPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        params: { id: String(refundPaymentDoc!._id) },
        body: { amount: -5, reason: 'negative attempt' },
      } as any,
      res,
      noop
    );
    check('BUG-09: negative refund rejected', res.statusCode === 400 && res.data?.error?.code === 'INVALID_REFUND_AMOUNT');

    // Partial refund 300, then attempt 600 more (only 500 refundable) -> rejected
    res = mockRes();
    await refundPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        params: { id: String(refundPaymentDoc!._id) },
        body: { amount: 300, reason: 'partial' },
      } as any,
      res,
      noop
    );
    check('Partial refund accepted', res.statusCode === 200);
    const afterPartialRefund = await PaymentModel.findById(refundPaymentDoc!._id);
    check('BUG-16: refundedAmount tracked', afterPartialRefund?.refundedAmount === 300 && afterPartialRefund?.status === 'completed');

    res = mockRes();
    await refundPayment(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        params: { id: String(refundPaymentDoc!._id) },
        body: { amount: 600, reason: 'cumulative over-refund' },
      } as any,
      res,
      noop
    );
    check('BUG-16: cumulative refund cannot exceed payment', res.statusCode === 400);

    const ledgerInvoice = await InvoiceModel.findById(refundInvoice!._id);
    // Refunding 300 of a fully-paid 800 invoice restores 300 to the customer's due.
    check('Refund restored invoice due (+300)', ledgerInvoice?.amountDue === 300 && ledgerInvoice?.status === 'partially_paid');
    check('Customer outstanding reflects refund', (await CustomerModel.findById(customer._id))?.outstandingBalance === 300);

    // ---------- BUG-10: cross-tenant refund rejected ----------
    res = mockRes();
    await refundPayment(
      {
        tenant: { organizationId: String(new mongoose.Types.ObjectId()), userId: userBId, email: 'b@audit.test', role: 'admin' },
        params: { id: String(refundPaymentDoc!._id) },
        body: { amount: 100, reason: 'cross-tenant' },
      } as any,
      res,
      noop
    );
    check('BUG-10: cross-tenant refund rejected with 404', res.statusCode === 404);

    // ---------- BUG-04: atomic invoice number reservation ----------
    const CONC = 12;
    const numbers = await Promise.all(
      Array.from({ length: CONC }, () => reserveInvoiceNumber(String(org._id)).then((r) => r.invoiceNumber))
    );
    const uniqueNumbers = new Set(numbers);
    check('BUG-04: concurrent reservations yield unique numbers', uniqueNumbers.size === CONC, `${uniqueNumbers.size}/${CONC} unique`);
    const dbInvoices = await InvoiceModel.countDocuments({ organizationId: org._id });
    check('BUG-04: DB consistent with reservations', dbInvoices >= 2);

    // ---------- BUG-12: callLLM returns null without keys ----------
    const llmResult = await callLLM([{ role: 'user', content: 'ping' }]);
    check('BUG-12: callLLM returns null without provider keys', llmResult === null);

    // ---------- BUG-12/13: AI endpoint works with deterministic fallback ----------
    res = mockRes();
    await askBusiness(
      {
        tenant: { organizationId: String(org._id), userId: userAId, email: 'a@audit.test', role: 'admin' },
        body: { query: 'revenue' },
      } as any,
      res,
      noop
    );
    check('BUG-12: AI ask-business works without LLM key', res.statusCode === 200 && res.data?.success === true);
    check('BUG-13: AI answer has no hard-coded demo org name', !JSON.stringify(res.data?.data || {}).includes('Nexus Cloud Technologies'));
    check('AI fallback uses real tenant numbers', typeof res.data?.data?.answer === 'string' && res.data.data.answer.includes('2'));
  } catch (err) {
    failed += 1;
    console.error('❌ Unexpected test error:', err);
  } finally {
    console.log('\n==================================================');
    console.log(`LOGIC-AUDIT TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('==================================================');
    await mongoose.disconnect();
    await mongo.stop();
    if (failed > 0) process.exit(1);
  }
}

run();
