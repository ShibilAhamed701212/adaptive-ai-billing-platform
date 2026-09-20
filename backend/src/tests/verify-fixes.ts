import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { OrganizationModel } from '../models/Organization.model';
import { ProductModel } from '../models/Product.model';
import { CustomerModel } from '../models/Customer.model';
import { InvoiceModel } from '../models/Invoice.model';
import { PaymentModel } from '../models/Payment.model';
import { LoyaltyTransactionModel } from '../models/LoyaltyTransaction.model';
import { posCheckout } from '../modules/pos/pos.controller';
import { getGSTSummaryReport } from '../modules/reports/report.controller';

import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function run() {
  console.log('Initializing MongoMemoryReplSet for verification...');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { directConnection: true });
  console.log('Connected to MongoDB replica set');

  // Pre-initialize schemas
  await OrganizationModel.init();
  await ProductModel.init();
  await CustomerModel.init();
  await InvoiceModel.init();
  await PaymentModel.init();
  await LoyaltyTransactionModel.init();
  await new Promise((resolve) => setTimeout(resolve, 500));

  const org = await OrganizationModel.create({
    name: 'Verification Retail Store',
    slug: 'verify-store',
    adminEmail: 'admin@verify.local',
    plan: 'enterprise',
    settings: { nextInvoiceNumber: 1, taxSystem: 'GST', currency: 'INR' },
  });
  const orgId = org._id.toString();

  const userId = new mongoose.Types.ObjectId().toString();
  const tenantCtx = {
    organizationId: orgId,
    userId,
    role: 'admin',
    email: 'test@verifier.local'
  };

  const mockRes = () => {
    const res: any = {};
    res.statusCode = 200;
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (d: any) => { res.data = d; return res; };
    return res;
  };

  console.log('\n=============================================');
  console.log('1. VERIFYING GST SUMMARY REPORT KPI STRUCTURE');
  console.log('=============================================');

  const gstRes = mockRes();
  await getGSTSummaryReport(
    { tenant: tenantCtx, query: {} } as any,
    gstRes as any,
    (e: any) => { if (e) throw e; }
  );

  const gstData = gstRes.data?.data;
  console.log('GST Summary Output Keys:', Object.keys(gstData || {}));
  console.log('Summary block:', gstData?.summary);
  console.log('Total Taxable Value:', gstData?.summary?.totalTaxable);
  console.log('CGST Total:', gstData?.summary?.cgstTotal);
  console.log('SGST Total:', gstData?.summary?.sgstTotal);
  console.log('IGST Total:', gstData?.summary?.igstTotal);
  console.log('Total GST:', gstData?.summary?.totalTax);
  console.log('Rate Breakdown entries:', gstData?.rateBreakdown?.length || 0);
  console.log('HSN Summary entries:', gstData?.hsnSummary?.length || 0);

  if (!gstData?.summary || gstData.summary.totalTax === undefined || gstData.summary.totalTaxable === undefined) {
    throw new Error('GST Summary structure verification failed!');
  }
  console.log('✅ GST Summary KPI structure matches frontend expectation (summary.totalTax, summary.totalTaxable, etc.)');

  console.log('\n=============================================');
  console.log('2. VERIFYING LOYALTY REDEMPTION WORKFLOW');
  console.log('=============================================');

  // Create a dedicated test customer with 100 loyalty points
  const customer = await CustomerModel.create({
    organizationId: org._id,
    name: 'Loyalty Test Customer',
    email: 'loyalty_test@example.com',
    phone: '9999988888',
    loyaltyPoints: 100,
    outstandingBalance: 0,
    storeCreditBalance: 0,
  });

  // Find or create a test product
  let product = await ProductModel.findOne({ organizationId: org._id });
  if (!product) {
    product = await ProductModel.create({
      organizationId: org._id,
      name: 'Verification Item',
      sku: 'VERIFY-001',
      unitPrice: 100,
      costPrice: 70,
      stockQuantity: 100,
      taxRate: 0.18,
      manageInventory: true,
    });
  }

  // --- Step A: Successful Redemption of 50 Points ---
  console.log('\n--- Step 2A: Redeem 50 Points on a ₹118 bill ---');
  const clientTxId = 'TX-LOYALTY-' + Date.now();
  const checkoutRes1 = mockRes();
  
  // Grand total = 100 + 18% = 118.
  // Loyalty redemption = 50 pts (= ₹50).
  // Cash payment = ₹68. Total tender = ₹118.
  await posCheckout(
    {
      tenant: tenantCtx,
      body: {
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 100 }],
        loyaltyPointsRedeemed: 50,
        splitPayments: [
          { method: 'cash', amount: 68 }
        ],
        clientTransactionId: clientTxId,
      }
    } as any,
    checkoutRes1 as any,
    (e: any) => { if (e) throw e; }
  );

  if (!checkoutRes1.data?.success) {
    throw new Error('Checkout with loyalty redemption failed: ' + JSON.stringify(checkoutRes1.data));
  }

  const invoice1 = checkoutRes1.data.data.invoice;
  console.log('Invoice Created:', invoice1.invoiceNumber);
  console.log('Invoice Loyalty Points Redeemed:', invoice1.loyaltyPointsRedeemed);
  console.log('Invoice Loyalty Discount Amount:', invoice1.loyaltyDiscountAmount);
  console.log('Invoice Customer Balance after tx:', invoice1.customerLoyaltyPointsBalance);

  // Check customer in DB
  const updatedCustomer1 = await CustomerModel.findById(customer._id);
  console.log('Customer Loyalty Points in DB:', updatedCustomer1?.loyaltyPoints);

  // Check LoyaltyTransaction records in DB
  const redemptionLog = await LoyaltyTransactionModel.findOne({
    customerId: customer._id,
    type: 'REDEMPTION'
  });
  console.log('Loyalty REDEMPTION record exists:', !!redemptionLog, 'Points deducted:', redemptionLog?.points, '₹ value:', redemptionLog?.pointsValueInRupees);

  const accrualLog = await LoyaltyTransactionModel.findOne({
    customerId: customer._id,
    type: 'ACCRUAL',
    referenceId: invoice1._id
  });
  console.log('Loyalty ACCRUAL record on net spend exists:', !!accrualLog, 'Points earned:', accrualLog?.points);

  // Check payment records
  const loyaltyPayment = await PaymentModel.findOne({
    invoiceId: invoice1._id,
    paymentMethod: 'loyalty_points'
  });
  console.log('Payment method "loyalty_points" recorded:', !!loyaltyPayment, 'Amount:', loyaltyPayment?.amount);

  if (
    invoice1.loyaltyPointsRedeemed !== 50 ||
    !redemptionLog ||
    redemptionLog.points !== -50 ||
    !loyaltyPayment ||
    loyaltyPayment.amount !== 50
  ) {
    throw new Error('Loyalty redemption records verification failed!');
  }
  console.log('✅ Step 2A PASSED: 50 points redeemed successfully.');

  // --- Step B: Duplicate Sync / Idempotency Check ---
  console.log('\n--- Step 2B: Duplicate checkout with identical clientTransactionId ---');
  const checkoutResDup = mockRes();
  await posCheckout(
    {
      tenant: tenantCtx,
      body: {
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 100 }],
        loyaltyPointsRedeemed: 50,
        splitPayments: [{ method: 'cash', amount: 68 }],
        clientTransactionId: clientTxId, // SAME ID
      }
    } as any,
    checkoutResDup as any,
    (e: any) => { if (e) throw e; }
  );

  const customerAfterDup = await CustomerModel.findById(customer._id);
  if (customerAfterDup?.loyaltyPoints !== updatedCustomer1?.loyaltyPoints) {
    throw new Error('Idempotency failed: Duplicate checkout altered customer loyalty points!');
  }
  console.log('✅ Step 2B PASSED: Duplicate sync idempotency verified (points balance untouched).');

  // --- Step C: Insufficient Loyalty Points Guard ---
  console.log('\n--- Step 2C: Attempting to redeem more points than customer balance ---');
  let overRedeemCaught = false;
  try {
    await posCheckout(
      {
        tenant: tenantCtx,
        body: {
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 100 }],
          loyaltyPointsRedeemed: 9999, // Customer does not have 9999 points
          splitPayments: [{ method: 'cash', amount: 0 }],
        }
      } as any,
      mockRes() as any,
      (err: any) => {
        if (err && err.message.includes('Insufficient loyalty points')) {
          overRedeemCaught = true;
        }
      }
    );
  } catch (err: any) {
    if (err.message.includes('Insufficient loyalty points')) overRedeemCaught = true;
  }

  if (!overRedeemCaught) {
    throw new Error('Over-redemption guard failed: Allowed redeeming more points than balance!');
  }
  console.log('✅ Step 2C PASSED: Insufficient loyalty points error thrown as expected.');

  // --- Step D: Exceeding Invoice Total Guard ---
  console.log('\n--- Step 2D: Attempting to redeem more points than invoice total ---');
  let overTotalCaught = false;
  await CustomerModel.findByIdAndUpdate(customer._id, { loyaltyPoints: 500 });
  try {
    await posCheckout(
      {
        tenant: tenantCtx,
        body: {
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 100 }], // Total = 118
          loyaltyPointsRedeemed: 200, // 200 > 118
          splitPayments: [],
        }
      } as any,
      mockRes() as any,
      (err: any) => {
        if (err && (err.message.includes('cannot exceed') || err.message.includes('invoice total') || err.message.includes('exceed total bill'))) {
          overTotalCaught = true;
        }
      }
    );
  } catch (err: any) {
    if (err && (err.message.includes('cannot exceed') || err.message.includes('invoice total') || err.message.includes('exceed total bill'))) overTotalCaught = true;
  }

  if (!overTotalCaught) {
    throw new Error('Over-total guard failed: Allowed redeeming points exceeding total bill!');
  }
  console.log('✅ Step 2D PASSED: Points exceeding total bill rejected as expected.');

  // --- Step 2E: Verify GST Summary Report with Non-Zero Calculation ---
  console.log('\n=============================================');
  console.log('3. VERIFYING NON-ZERO GST SUMMARY REPORT ON REAL INVOICE');
  console.log('=============================================');
  const gstRes2 = mockRes();
  await getGSTSummaryReport(
    { tenant: tenantCtx, query: {} } as any,
    gstRes2 as any,
    (e: any) => { if (e) throw e; }
  );
  const gstData2 = gstRes2.data?.data;
  console.log('GST Summary Data:', JSON.stringify(gstData2?.summary, null, 2));
  console.log('Rate Breakdown:', JSON.stringify(gstData2?.rateBreakdown, null, 2));

  if (!gstData2?.summary || gstData2.summary.totalTax !== 18 || gstData2.summary.totalTaxable !== 100) {
    throw new Error(`GST Summary non-zero calculation failed! Expected totalTax=18, totalTaxable=100. Received: ${JSON.stringify(gstData2?.summary)}`);
  }
  console.log('✅ Step 3 PASSED: Non-zero GST calculation verified! (Taxable: ₹100, Total GST: ₹18, CGST: ₹9, SGST: ₹9)');

  // --- Step 2F: Verify Atomic Transaction Rollback on Failure ---
  console.log('\n=============================================');
  console.log('4. VERIFYING ATOMIC ROLLBACK ON CHECKOUT FAILURE');
  console.log('=============================================');
  const customerBeforeFailedTx = await CustomerModel.findById(customer._id);
  const initialBalance = customerBeforeFailedTx?.loyaltyPoints || 0;
  let rollbackCaught = false;
  try {
    await posCheckout(
      {
        tenant: tenantCtx,
        body: {
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 100 }],
          loyaltyPointsRedeemed: 20,
          splitPayments: [{ method: 'invalid_method_fail', amount: 98 }], // Triggers schema validation failure
        }
      } as any,
      mockRes() as any,
      (err: any) => {
        if (err) rollbackCaught = true;
      }
    );
  } catch (err: any) {
    rollbackCaught = true;
  }

  const customerAfterFailedTx = await CustomerModel.findById(customer._id);
  console.log('Customer points before failed attempt:', initialBalance);
  console.log('Customer points after failed attempt:', customerAfterFailedTx?.loyaltyPoints);

  if (!rollbackCaught || customerAfterFailedTx?.loyaltyPoints !== initialBalance) {
    throw new Error('Atomic rollback failed! Loyalty points were deducted or not restored.');
  }
  console.log('✅ Step 4 PASSED: Atomic rollback confirmed. No points were deducted during aborted transaction.');

  // Clean up test data
  console.log('\nCleaning up verification records...');
  await PaymentModel.deleteMany({ invoiceId: invoice1._id });
  await InvoiceModel.findByIdAndDelete(invoice1._id);
  await LoyaltyTransactionModel.deleteMany({ customerId: customer._id });
  await CustomerModel.findByIdAndDelete(customer._id);
  console.log('Clean up completed.');

  console.log('\n=============================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=============================================');

  await mongoose.disconnect();
  await replSet.stop();
  process.exit(0);
}

run().catch((e) => {
  console.error('VERIFICATION FAILURE:', e);
  process.exit(1);
});
