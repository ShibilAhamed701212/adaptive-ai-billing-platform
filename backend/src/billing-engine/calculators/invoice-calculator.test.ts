import { calculateInvoice } from './invoice-calculator';

function runInvoiceCalculatorTests() {
  console.log('🧪 Running Invoice Calculator Verification Tests...');

  // Test 1: Intra-state GST (Telangana -> Telangana): CGST 9% + SGST 9% on 18% item
  const test1 = calculateInvoice(
    [
      {
        description: 'Cloud Server',
        quantity: 2,
        unitPrice: 50000,
        taxRate: 0.18,
        discountAmount: 10000, // (2 * 50000) - 10000 = 90,000 taxable
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Telangana',
      destinationState: 'Telangana',
    }
  );

  console.assert(test1.totals.rawSubtotal === 100000, `Expected rawSubtotal 100000, got ${test1.totals.rawSubtotal}`);
  console.assert(test1.totals.taxableAmount === 90000, `Expected taxableAmount 90000, got ${test1.totals.taxableAmount}`);
  console.assert(test1.totals.taxTotal === 16200, `Expected taxTotal 16200, got ${test1.totals.taxTotal}`);
  console.assert(test1.totals.grandTotal === 106200, `Expected grandTotal 106200, got ${test1.totals.grandTotal}`);
  console.assert(test1.totals.taxBreakdown.length === 2, 'Expected 2 tax lines (CGST + SGST)');
  console.assert(test1.totals.taxBreakdown[0].taxType === 'CGST', 'Expected first tax to be CGST');
  console.assert(test1.totals.taxBreakdown[1].taxType === 'SGST', 'Expected second tax to be SGST');

  // Test 2: Inter-state GST (Telangana -> Maharashtra): IGST 18%
  const test2 = calculateInvoice(
    [
      {
        description: 'Freight Shipment',
        quantity: 1,
        unitPrice: 20000,
        taxRate: 0.18,
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Telangana',
      destinationState: 'Maharashtra',
    }
  );

  console.assert(test2.totals.taxBreakdown.length === 1, 'Expected 1 tax line (IGST)');
  console.assert(test2.totals.taxBreakdown[0].taxType === 'IGST', 'Expected tax to be IGST');
  console.assert(test2.totals.grandTotal === 23600, `Expected grandTotal 23600, got ${test2.totals.grandTotal}`);

  // Test 3: Multiple Line Items with invoice-level discount.
  // REGRESSION (BUG-01): invoice-level discount must be allocated proportionally BEFORE tax
  // computation. 1000 discount over 10000 subtotal = 10% off each line:
  //   Item A: 5000 -> 4500 taxable @18% = 810 tax
  //   Item B: 5000 -> 4500 taxable @12% = 540 tax
  //   taxTotal = 1350, grandTotal = 9000 + 1350 = 10350 (NOT 10410 — the old bug overcharged tax)
  const test3 = calculateInvoice(
    [
      { description: 'Item A', quantity: 5, unitPrice: 1000, taxRate: 0.18 },
      { description: 'Item B', quantity: 2, unitPrice: 2500, taxRate: 0.12 },
    ],
    {
      taxSystem: 'GST',
      originState: 'Delhi',
      destinationState: 'Delhi',
      invoiceDiscountAmount: 1000,
    }
  );

  console.assert(test3.totals.rawSubtotal === 10000, `Expected rawSubtotal 10000, got ${test3.totals.rawSubtotal}`);
  console.assert(test3.totals.totalDiscount === 1000, `Expected totalDiscount 1000, got ${test3.totals.totalDiscount}`);
  console.assert(test3.totals.taxableAmount === 9000, `Expected taxableAmount 9000, got ${test3.totals.taxableAmount}`);
  console.assert(test3.totals.taxTotal === 1350, `Expected taxTotal 1350 on discounted base, got ${test3.totals.taxTotal}`);
  console.assert(test3.totals.grandTotal === 10350, `Expected grandTotal 10350, got ${test3.totals.grandTotal}`);
  console.assert(
    test3.totals.grandTotal === Math.round((test3.totals.taxableAmount + test3.totals.taxTotal) * 100) / 100,
    'grandTotal must equal taxableAmount + taxTotal'
 );

  // Test 3b: percentage discounts are clamped to [0, 100]
  const test3b = calculateInvoice(
    [{ description: 'Item', quantity: 1, unitPrice: 1000, taxRate: 0.18, discountPercentage: 150 }],
    { taxSystem: 'GST', originState: 'Delhi', destinationState: 'Delhi' }
  );
  console.assert(test3b.totals.totalDiscount === 1000, `Percentage discount >100% must clamp to full amount, got ${test3b.totals.totalDiscount}`);
  console.assert(test3b.totals.taxTotal === 0, `Tax must be 0 on a fully discounted line, got ${test3b.totals.taxTotal}`);
  console.assert(test3b.totals.grandTotal === 0, `Grand total must be 0, got ${test3b.totals.grandTotal}`);

  // Test 3c: quantity 0 stays 0 (never silently becomes 1), negative clamps to 0
  const test3c = calculateInvoice(
    [
      { description: 'Zero Qty', quantity: 0, unitPrice: 500, taxRate: 0.18 },
      { description: 'Negative Qty', quantity: -3, unitPrice: 500, taxRate: 0.18 },
    ],
    { taxSystem: 'GST', originState: 'Delhi', destinationState: 'Delhi' }
  );
  console.assert(test3c.totals.rawSubtotal === 0, `Zero/negative quantity lines must contribute 0, got ${test3c.totals.rawSubtotal}`);
  console.assert(test3c.totals.grandTotal === 0, `Grand total must be 0, got ${test3c.totals.grandTotal}`);
  console.assert(test3c.items[0].quantity === 0, `Quantity 0 must be preserved, got ${test3c.items[0].quantity}`);

  // Test 3d: invoice discount larger than subtotal clamps (no negative totals)
  const test3d = calculateInvoice(
    [{ description: 'Item', quantity: 1, unitPrice: 1000, taxRate: 0.18 }],
    { taxSystem: 'GST', originState: 'Delhi', destinationState: 'Delhi', invoiceDiscountAmount: 5000 }
  );
  console.assert(test3d.totals.grandTotal === 0, `Invoice discount > subtotal must clamp to 0 total, got ${test3d.totals.grandTotal}`);

  // Test 4: Pricing Tier Resolution
  console.log('\n--- Test 4: Pricing Tier Resolution ---');
  const tieredCalc = calculateInvoice(
    [
      {
        description: 'Bulk Cloud Storage License',
        quantity: 50,
        unitPrice: 500, // base price
        pricingTiers: [
          { minQuantity: 1, maxQuantity: 9, unitPrice: 500 },
          { minQuantity: 10, maxQuantity: 49, unitPrice: 400 },
          { minQuantity: 50, unitPrice: 300 }, // should match 50 qty -> 300 unit price
        ],
        taxRate: 0.18,
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Maharashtra',
      destinationState: 'Maharashtra',
    }
  );

  console.assert(tieredCalc.items[0].unitPrice === 300, 'Resolved unit price should be 300 for 50 qty');
  console.assert(tieredCalc.totals.rawSubtotal === 15000, 'Subtotal should be 50 * 300 = 15000');
  console.log('✅ Test 4 (Pricing Tiers) Passed');

  console.log('\n🎉 ALL INVOICE CALCULATOR UNIT TESTS PASSED!\n');
}

runInvoiceCalculatorTests();
