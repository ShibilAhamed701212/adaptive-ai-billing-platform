import { MongoMemoryReplSet } from 'mongodb-memory-server';
import '../core/tenancy/tenant.middleware';
import mongoose from 'mongoose';
import { OrganizationModel } from '../models/Organization.model';
import { ProductModel } from '../models/Product.model';
import { CustomerModel } from '../models/Customer.model';
import { InvoiceModel } from '../models/Invoice.model';
import { PaymentModel } from '../models/Payment.model';
import { InventoryMovementModel } from '../models/InventoryMovement.model';
import { LedgerTransactionModel } from '../models/LedgerTransaction.model';
import { LoyaltyTransactionModel } from '../models/LoyaltyTransaction.model';
import { posCheckout } from '../modules/pos/pos.controller';
import { Request, Response } from 'express';

let mongoServer: MongoMemoryReplSet;

async function setup() {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

async function teardown() {
  await mongoose.disconnect();
  await mongoServer.stop();
}

async function runTests() {
  await setup();
  console.log('--- Starting POS E2E Tests ---');
  let passed = 0;
  let failed = 0;

  try {
    const org = await OrganizationModel.create({
      name: 'Test Org',
      slug: 'test-org',
      adminEmail: 'admin@test.com',
      plan: 'enterprise',
      settings: { nextInvoiceNumber: 1, taxSystem: 'GST', currency: 'INR' }
    });

    const userObjId = new mongoose.Types.ObjectId();

    const product = await ProductModel.create({
      organizationId: org._id,
      name: 'Test Item',
      sku: 'SKU123',
      barcode: '123456789',
      unitPrice: 100,
      taxRate: 0.18,
      manageInventory: true,
      stockQuantity: 10,
    });

    const customer = await CustomerModel.create({
      organizationId: org._id,
      name: 'John Doe',
      email: 'john@example.com',
      outstandingBalance: 0
    });

    // Ensure collections and indexes are built before multi-document transactions run
    await OrganizationModel.init();
    await ProductModel.init();
    await CustomerModel.init();
    await InvoiceModel.init();
    await PaymentModel.init();
    await InventoryMovementModel.init();
    await LedgerTransactionModel.init();
    await LoyaltyTransactionModel.init();

    const { AuditLogModel } = require('../core/audit/audit.service');
    await AuditLogModel.init();

    // Allow catalog changes to settle in replica set
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Mock Express Req/Res
    const mockRequest = (body: any): any => ({
      tenant: { organizationId: org._id.toString(), userId: userObjId.toString(), role: 'admin', email: 'admin@test.com' },
      body
    });

    const mockResponse = (): any => {
      const res: any = {};
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (data: any) => { res.data = data; return res; };
      return res;
    };

    // TEST A: Atomic Sale with Split Payments and Inventory Deduction
    console.log('Running TEST A: Atomic POS Sale...');
    const reqA = mockRequest({
      customerId: customer._id.toString(),
      items: [
        { productId: product._id.toString(), quantity: 2, unitPrice: 100 }
      ],
      splitPayments: [
        { method: 'cash', amount: 150 },
        { method: 'upi', amount: 50 }
      ] 
    });
    // 2 * 100 = 200 + 18% tax (36) = 236 total
    // Paid 200. Due = 36.

    const resA = mockResponse();
    await posCheckout(reqA as Request, resA as Response, (err) => { if(err) throw err; });

    if (resA.data && resA.data.success) {
      const dbProd = await ProductModel.findById(product._id);
      const dbCust = await CustomerModel.findById(customer._id);
      const invMove = await InventoryMovementModel.findOne({ productId: product._id });
      const ledger = await LedgerTransactionModel.findOne({ customerId: customer._id });

      if (dbProd?.stockQuantity === 8 && dbCust?.outstandingBalance === 36 && invMove && ledger) {
        console.log('✅ TEST A PASSED: Stock updated, Customer ledger updated, Movements recorded.');
        passed++;
      } else {
        console.log('❌ TEST A FAILED: DB state incorrect.', { stock: dbProd?.stockQuantity, due: dbCust?.outstandingBalance });
        failed++;
      }
    } else {
      console.log('❌ TEST A FAILED: API response failure');
      failed++;
    }

    // TEST B: Prevent Overselling
    console.log('Running TEST B: Prevent Overselling...');
    const reqB = mockRequest({
      customerId: customer._id.toString(),
      items: [
        { productId: product._id.toString(), quantity: 10, unitPrice: 100 }
      ],
      splitPayments: [{ method: 'cash', amount: 1180 }]
    });

    const resB = mockResponse();
    let errorCaught = false;
    await posCheckout(reqB as Request, resB as Response, (err) => { 
      if(err && err.message.includes('Insufficient stock')) {
        errorCaught = true;
      } 
    });
    if (errorCaught) {
      console.log('✅ TEST B PASSED: Caught insufficient stock error.');
      passed++;
    } else {
      console.log('❌ TEST B FAILED: Allowed overselling.');
      failed++;
    }

  } catch (error) {
    console.error('Fatal Test Error:', error);
  } finally {
    console.log(`--- Test Summary: ${passed} Passed, ${failed} Failed ---`);
    await teardown();
  }
}

runTests();
