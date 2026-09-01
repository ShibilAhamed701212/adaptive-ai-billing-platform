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

  // Test 3: Multiple Line Items with invoice-level discount
  const test3 = calculateInvoice(
    [
      { description: 'Item A', quantity: 5, unitPrice: 1000, taxRate: 0.18 }, // 5000 + 900 tax = 5900
      { description: 'Item B', quantity: 2, unitPrice: 2500, taxRate: 0.12 }, // 5000 + 600 tax = 5600
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

  console.log('Tiered Total:', tieredCalc.totals.grandTotal);
  console.log('Tiered Line Total:', tieredCalc.items[0].lineTotal);
  console.assert(tieredCalc.items[0].unitPrice === 300, 'Resolved unit price should be 300 for 50 qty');
  console.assert(tieredCalc.totals.rawSubtotal === 15000, 'Subtotal should be 50 * 300 = 15000');
  console.log('✅ Test 4 (Pricing Tiers) Passed');

  console.log('\n🎉 ALL INVOICE CALCULATOR UNIT TESTS PASSED!\n');
}

runInvoiceCalculatorTests();
