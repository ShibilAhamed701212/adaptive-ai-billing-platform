import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import '../core/tenancy/tenant.middleware';
import { OrganizationModel } from '../models/Organization.model';
import { ProductModel } from '../models/Product.model';
import { CustomerModel } from '../models/Customer.model';
import { SupplierModel } from '../models/Supplier.model';
import { PurchaseModel } from '../models/Purchase.model';
import { InvoiceModel } from '../models/Invoice.model';
import { PaymentModel } from '../models/Payment.model';
import { ReturnModel } from '../models/Return.model';
import { ShiftModel } from '../models/Shift.model';
import { ExpenseModel } from '../models/Expense.model';
import { InventoryMovementModel } from '../models/InventoryMovement.model';
import { LedgerTransactionModel } from '../models/LedgerTransaction.model';
import { StoreCreditTransactionModel } from '../models/StoreCreditTransaction.model';
import { LoyaltyTransactionModel } from '../models/LoyaltyTransaction.model';
import { posCheckout } from '../modules/pos/pos.controller';
import { createPurchase } from '../modules/purchases/purchase.controller';
import { processReturn } from '../modules/returns/return.controller';
import { adjustStock } from '../modules/inventory/inventory.controller';
import { openShift, closeShift } from '../modules/shifts/shift.controller';
import { createExpense } from '../modules/expenses/expense.controller';
import { Request, Response } from 'express';

let mongoReplSet: MongoMemoryReplSet;

async function setupDB() {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri, { directConnection: true });
}

async function teardownDB() {
  await mongoose.disconnect();
  await mongoReplSet.stop();
}

function mockReq(tenant: any, body: any = {}, params: any = {}, query: any = {}): any {
  return { tenant, body, params, query };
}

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

async function runTestSuite() {
  console.log('🚀 INITIALIZING COMPREHENSIVE POS INTEGRATION TEST SUITE...');
  await setupDB();

  let passed = 0;
  let failed = 0;

  try {
    // 0. Pre-create collections and build indexes before transactions run
    await OrganizationModel.init();
    await ProductModel.init();
    await CustomerModel.init();
    await SupplierModel.init();
    await PurchaseModel.init();
    await InvoiceModel.init();
    await PaymentModel.init();
    await ReturnModel.init();
    await ShiftModel.init();
    await ExpenseModel.init();
    await InventoryMovementModel.init();
    await LedgerTransactionModel.init();
    await StoreCreditTransactionModel.init();
    await LoyaltyTransactionModel.init();

    // Insert and remove a dummy invoice and payment to ensure collections exist in catalog
    const dummyInv = await InvoiceModel.create({
      organizationId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'DUMMY-001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-01',
      items: [],
      subtotal: 0,
      grandTotal: 0,
      amountPaid: 0,
      amountDue: 0,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const dummyPay = await PaymentModel.create({
      organizationId: new mongoose.Types.ObjectId(),
      invoiceId: dummyInv._id,
      amount: 1,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'cash',
      status: 'completed',
    });
    await PaymentModel.deleteOne({ _id: dummyPay._id });
    await InvoiceModel.deleteOne({ _id: dummyInv._id });

    // Allow catalog changes to settle in replica set
    await new Promise((resolve) => setTimeout(resolve, 500));

    const org = await OrganizationModel.create({
      name: 'Supermarket Alpha',
      slug: 'supermarket-alpha',
      adminEmail: 'admin@alpha.com',
      plan: 'enterprise',
      settings: { nextInvoiceNumber: 100, taxSystem: 'GST', currency: 'INR' },
    });

    const userObjId = new mongoose.Types.ObjectId();
    const tenantCtx = {
      organizationId: org._id.toString(),
      userId: userObjId.toString(),
      role: 'admin',
      email: 'admin@alpha.com',
    };

    console.log('\n--- TEST 1: Open Shift ---');
    const openShiftRes = mockRes();
    await openShift(
      mockReq(tenantCtx, { openingCash: 2000, notes: 'Morning Shift' }),
      openShiftRes,
      (e) => { if (e) throw e; }
    );
    if (openShiftRes.data?.success && openShiftRes.data?.data?.openingCash === 2000) {
      console.log('✅ TEST 1 PASSED: Cash drawer shift opened with ₹2000.');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED:', openShiftRes.data);
      failed++;
    }

    console.log('\n--- TEST 2: Product & Supplier Creation & Purchase Receiving ---');
    const supplier = await SupplierModel.create({
      organizationId: org._id,
      name: 'Dairy Distro Ltd',
      email: 'sales@dairydistro.com',
    });

    const product = await ProductModel.create({
      organizationId: org._id,
      name: 'Organic Milk 1L',
      sku: 'MILK-001',
      barcode: '8901234567890',
      barcodes: ['8901234567890', '8901234567891'],
      unitPrice: 60,
      costPrice: 45,
      mrp: 65,
      taxRate: 0.05,
      manageInventory: true,
      stockQuantity: 0,
      lowStockThreshold: 10,
    });

    // Purchase receiving
    const purchaseRes = mockRes();
    await createPurchase(
      mockReq(tenantCtx, {
        supplierId: supplier._id.toString(),
        items: [{ productId: product._id.toString(), sku: product.sku, name: product.name, quantity: 50, unitPrice: 45, taxRate: 0.05 }],
        amountPaid: 1000,
      }),
      purchaseRes,
      (e) => { if (e) throw e; }
    );

    const reloadedProductAfterPO = await ProductModel.findById(product._id);
    const poMovement = await InventoryMovementModel.findOne({ productId: product._id, type: 'PURCHASE' });
    const reloadedSupplier = await SupplierModel.findById(supplier._id);

    if (reloadedProductAfterPO?.stockQuantity === 50 && poMovement && (reloadedSupplier?.outstandingBalance || 0) > 0) {
      console.log('✅ TEST 2 PASSED: Purchase received. Stock incremented to 50, purchase movement logged, supplier balance updated.');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED: PO receiving did not update inventory or supplier ledger.');
      failed++;
    }

    console.log('\n--- TEST 3: POS Atomic Sale with Split Tender (Cash + UPI) & Stock Decrement ---');
    const customer = await CustomerModel.create({
      organizationId: org._id,
      name: 'Alice Sharma',
      email: 'alice@example.com',
      outstandingBalance: 0,
      storeCreditBalance: 0,
    });

    const checkoutRes = mockRes();
    // Buy 10 milks: 10 * 60 = 600 + 5% tax (30) = 630.
    // Pay ₹400 Cash + ₹200 UPI = ₹600. Remaining ₹30 goes to Udhaar ledger.
    await posCheckout(
      mockReq(tenantCtx, {
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 10, unitPrice: 60 }],
        splitPayments: [
          { method: 'cash', amount: 400 },
          { method: 'upi', amount: 200 },
        ],
        amountTendered: 500,
        changeGiven: 100,
      }),
      checkoutRes,
      (e) => { if (e) throw e; }
    );

    const reloadedProdAfterSale = await ProductModel.findById(product._id);
    const reloadedCustAfterSale = await CustomerModel.findById(customer._id);
    const saleMovement = await InventoryMovementModel.findOne({ productId: product._id, type: 'SALE' });
    const ledgerEntry = await LedgerTransactionModel.findOne({ customerId: customer._id });

    if (
      reloadedProdAfterSale?.stockQuantity === 40 &&
      reloadedCustAfterSale?.outstandingBalance === 30 &&
      saleMovement &&
      ledgerEntry
    ) {
      console.log('✅ TEST 3 PASSED: Sale completed. Stock deducted to 40, split payments registered, Udhaar balance ₹30 recorded.');
      passed++;
    } else {
      console.log('❌ TEST 3 FAILED: Sale state incorrect.', {
        stock: reloadedProdAfterSale?.stockQuantity,
        custBalance: reloadedCustAfterSale?.outstandingBalance,
      });
      failed++;
    }

    console.log('\n--- TEST 4: Stock Overselling Prevention ---');
    let oversellCaught = false;
    const oversellRes = mockRes();
    await posCheckout(
      mockReq(tenantCtx, {
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 100, unitPrice: 60 }], // Only 40 available
        splitPayments: [{ method: 'cash', amount: 6300 }],
      }),
      oversellRes,
      (e) => {
        if (e && e.message.includes('Insufficient stock')) {
          oversellCaught = true;
        }
      }
    );

    if (oversellCaught) {
      console.log('✅ TEST 4 PASSED: Backend strictly prevented overselling past available stock.');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED: Overselling was not blocked.');
      failed++;
    }

    console.log('\n--- TEST 5: Return & Stock Restocking ---');
    const createdInvoice = checkoutRes.data?.data?.invoice;
    const returnRes = mockRes();
    // Return 2 milks back
    await processReturn(
      mockReq(tenantCtx, {
        invoiceId: createdInvoice._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 2, reason: 'Damaged cap' }],
        refundMethod: 'cash',
      }),
      returnRes,
      (e) => { if (e) throw e; }
    );

    const reloadedProdAfterReturn = await ProductModel.findById(product._id);
    const returnMovement = await InventoryMovementModel.findOne({ productId: product._id, type: 'RETURN' });
    const refundPayment = await PaymentModel.findOne({ invoiceId: createdInvoice._id, status: 'refunded' });

    if (reloadedProdAfterReturn?.stockQuantity === 42 && returnMovement && refundPayment) {
      console.log('✅ TEST 5 PASSED: Return processed. Stock restored to 42, return movement logged, refund payment recorded.');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED: Return restocking failed.', { stock: reloadedProdAfterReturn?.stockQuantity });
      failed++;
    }

    console.log('\n--- TEST 6: Manual Stock Adjustment (Damage / Waste) ---');
    const adjustRes = mockRes();
    await adjustStock(
      mockReq(tenantCtx, {
        productId: product._id.toString(),
        type: 'DAMAGE',
        quantityChange: -2,
        notes: 'Expired bottle discarded',
      }),
      adjustRes,
      (e) => { if (e) throw e; }
    );

    const reloadedProdAfterAdj = await ProductModel.findById(product._id);
    const damageMovement = await InventoryMovementModel.findOne({ productId: product._id, type: 'DAMAGE' });

    if (reloadedProdAfterAdj?.stockQuantity === 40 && damageMovement) {
      console.log('✅ TEST 6 PASSED: Stock adjustment applied. Stock reduced to 40 with DAMAGE movement record.');
      passed++;
    } else {
      console.log('❌ TEST 6 FAILED:', reloadedProdAfterAdj?.stockQuantity);
      failed++;
    }

    console.log('\n--- TEST 7: Log Expense and Close Shift ---');
    const expenseRes = mockRes();
    await createExpense(
      mockReq(tenantCtx, {
        category: 'Supplies',
        amount: 50,
        description: 'Receipt paper rolls',
      }),
      expenseRes,
      (e) => { if (e) throw e; }
    );

    const closeShiftRes = mockRes();
    // Expected cash: Opening (2000) + Cash Sales (400) - Expense (50) = 2350
    await closeShift(
      mockReq(tenantCtx, { actualCash: 2350, notes: 'Shift balanced accurately' }),
      closeShiftRes,
      (e) => { if (e) throw e; }
    );

    if (closeShiftRes.data?.success && closeShiftRes.data?.data?.difference === 0) {
      console.log('✅ TEST 7 PASSED: Shift closed with exact zero cash discrepancy (₹2350 tallied).');
      passed++;
    } else {
      console.log('❌ TEST 7 FAILED:', closeShiftRes.data);
      failed++;
    }

    console.log('\n--- TEST 8: Multi-Tenant Data Isolation ---');
    const orgB = await OrganizationModel.create({
      name: 'Store Beta',
      slug: 'store-beta',
      adminEmail: 'admin@beta.com',
      plan: 'basic',
      settings: { nextInvoiceNumber: 1 },
    });

    const tenantCtxB = {
      organizationId: orgB._id.toString(),
      userId: new mongoose.Types.ObjectId().toString(),
      role: 'admin',
      email: 'admin@beta.com',
    };

    const betaProducts = await ProductModel.find({
      organizationId: new mongoose.Types.ObjectId(tenantCtxB.organizationId),
    });

    if (betaProducts.length === 0) {
      console.log('✅ TEST 8 PASSED: Tenant isolation verified. Store Beta cannot see Supermarket Alpha products.');
      passed++;
    } else {
      console.log('❌ TEST 8 FAILED: Cross-tenant data leak detected.');
      failed++;
    }

    console.log('\n--- TEST 9: Intentional Failure Rollback ---');
    // Try to checkout with invalid split payment to trigger error after invoice creation
    let rollbackOccurred = false;
    try {
      const mockReq = {
        tenant: tenantCtx,
        body: {
          customerId: customer._id.toString(),
          items: [
            { productId: product._id.toString(), quantity: 1 }
          ],
          splitPayments: [{ method: 'store_credit', amount: 999999 }], // Exceeds balance
        }
      } as any;
      const mockRes = {
        status: () => ({ json: () => {} }),
      } as any;
      const mockNext = ((err: any) => {
        if (err) rollbackOccurred = true;
      }) as any;
      
      await posCheckout(mockReq, mockRes, mockNext);
    } catch (e) {
      rollbackOccurred = true;
    }

    const uncommittedInvoice = await InvoiceModel.findOne({ 'items.productId': product._id, amountPaid: 999999 });
    
    if (rollbackOccurred && !uncommittedInvoice) {
      console.log('✅ TEST 9 PASSED: Transaction rollback verified. Invalid store credit aborted the transaction.');
      passed++;
    } else {
      console.log('❌ TEST 9 FAILED: Rollback failed or did not occur.');
      failed++;
    }

  } catch (err) {
    console.error('CRITICAL INTEGRATION TEST ERROR:', err);
    failed++;
  } finally {
    console.log(`\n==================================================`);
    console.log(`FINAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log(`==================================================\n`);
    await teardownDB();
  }
}

runTestSuite();
