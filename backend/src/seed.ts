import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { OrganizationModel } from './models/Organization.model';
import { UserModel } from './models/User.model';
import { CustomerModel } from './models/Customer.model';
import { ProductModel } from './models/Product.model';
import { CustomFieldModel } from './models/CustomField.model';
import { BusinessRuleModel } from './models/BusinessRule.model';
import { InvoiceModel } from './models/Invoice.model';
import { PaymentModel } from './models/Payment.model';
import { calculateInvoice } from './billing-engine/calculators/invoice-calculator';
import { ENV } from './config/env';

async function seedDatabase() {
  console.log('🌱 Starting Database Seeding...');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(ENV.MONGODB_URI);
  }

  // Clear existing collections
  await Promise.all([
    OrganizationModel.deleteMany({}),
    UserModel.deleteMany({}),
    CustomerModel.deleteMany({}),
    ProductModel.deleteMany({}),
    CustomFieldModel.deleteMany({}),
    BusinessRuleModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    PaymentModel.deleteMany({}),
  ]);

  // 1. Create Demo Organization: Nexus Cloud Solutions (SaaS & Services)
  const org = await OrganizationModel.create({
    name: 'Nexus Cloud Technologies',
    slug: 'nexus-cloud',
    billingModel: 'subscription',
    enabledModules: ['invoices', 'customers', 'products', 'payments', 'subscriptions', 'reports', 'ai_copilot'],
    settings: {
      currency: 'INR',
      currencySymbol: '₹',
      timezone: 'Asia/Kolkata',
      taxSystem: 'GST',
      invoicePrefix: 'NEX',
      nextInvoiceNumber: 1005,
      paymentTermsDays: 15,
      primaryColor: '#6366f1',
      accentColor: '#10b981',
      address: {
        street: '402, Cyber Heights, HITEC City',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500081',
        country: 'India',
      },
      gstinOrTaxId: '36AAAAA0000A1Z5',
      website: 'https://nexuscloud.io',
    },
  });

  // 2. Create Admin & Accountant Users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123456', salt);

  const admin = await UserModel.create({
    organizationId: org._id,
    name: 'Sarah Chen (Admin)',
    email: 'admin@nexuscloud.io',
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  await UserModel.create({
    organizationId: org._id,
    name: 'Rajesh Kumar (Finance)',
    email: 'rajesh@nexuscloud.io',
    passwordHash,
    role: 'accountant',
    isActive: true,
  });

  // 3. Create Custom Fields for Org
  await CustomFieldModel.create([
    {
      organizationId: org._id,
      targetEntity: 'invoice',
      fieldName: 'projectCode',
      label: 'Client Project / PO Code',
      fieldType: 'text',
      required: false,
      placeholder: 'e.g. PRJ-2026-CLOUD',
      order: 1,
    },
    {
      organizationId: org._id,
      targetEntity: 'invoice',
      fieldName: 'billingCycle',
      label: 'Subscription Cycle',
      fieldType: 'select',
      options: ['Monthly', 'Quarterly', 'Annual', 'One-time'],
      required: false,
      order: 2,
    },
    {
      organizationId: org._id,
      targetEntity: 'customer',
      fieldName: 'slaTier',
      label: 'Enterprise SLA Level',
      fieldType: 'select',
      options: ['Standard 99.5%', 'Gold 99.9%', 'Platinum 99.99% Mission Critical'],
      required: false,
      order: 1,
    },
  ]);

  // 4. Create Business Rules
  await BusinessRuleModel.create([
    {
      organizationId: org._id,
      ruleName: 'High-Value Enterprise Discount',
      description: 'Automatically grant 5% discount on orders exceeding ₹1,00,000',
      event: 'beforeInvoiceCalculate',
      condition: { field: 'invoiceSubtotal', operator: 'greater_than', value: 100000 },
      action: { type: 'apply_discount', value: 5, message: '5% Enterprise Volume Discount' },
      isActive: true,
    },
    {
      organizationId: org._id,
      ruleName: 'Manager Approval on Huge Discounts',
      description: 'Require approval if line items exceed 10 items',
      event: 'beforeInvoiceCalculate',
      condition: { field: 'itemCount', operator: 'greater_than', value: 8 },
      action: { type: 'require_approval', value: true, message: 'Bulk batch order requires finance approval' },
      isActive: true,
    },
  ]);

  // 5. Create Products / Services Catalog
  const prod1 = await ProductModel.create({
    organizationId: org._id,
    name: 'Enterprise Cloud Infrastructure (Dedicated)',
    sku: 'INFRA-ENT-01',
    description: 'High-availability cluster with automated backup and 99.99% uptime SLA',
    type: 'subscription',
    unit: 'month',
    unitPrice: 75000,
    costPrice: 28000,
    taxRate: 0.18,
    hsnSacCode: '998313',
    isActive: true,
  });

  const prod2 = await ProductModel.create({
    organizationId: org._id,
    name: 'AI Agent Invoicing Copilot Add-On',
    sku: 'AI-COPILOT-SEAT',
    description: 'Autonomous financial analysis and invoice ingestion engine',
    type: 'service',
    unit: 'seat',
    unitPrice: 12000,
    costPrice: 2000,
    taxRate: 0.18,
    hsnSacCode: '998314',
    isActive: true,
  });

  const prod3 = await ProductModel.create({
    organizationId: org._id,
    name: 'Cloud Security & Compliance Audit',
    sku: 'SEC-AUDIT-PKG',
    description: 'SOC2 & ISO 27001 readiness assessment and penetration test report',
    type: 'service',
    unit: 'audit',
    unitPrice: 120000,
    costPrice: 40000,
    taxRate: 0.18,
    hsnSacCode: '998315',
    isActive: true,
  });

  const prod4 = await ProductModel.create({
    organizationId: org._id,
    name: 'DevOps & 24/7 Managed SRE Support',
    sku: 'DEV-SRE-MONTH',
    description: 'Round-the-clock incident response and Kubernetes cluster management',
    type: 'service',
    unit: 'month',
    unitPrice: 45000,
    costPrice: 15000,
    taxRate: 0.18,
    hsnSacCode: '998313',
    isActive: true,
  });

  // 6. Create Customers
  const cust1 = await CustomerModel.create({
    organizationId: org._id,
    name: 'Apex Global Logistics Ltd.',
    email: 'billing@apexlogistics.com',
    phone: '+91 98765 43210',
    companyName: 'Apex Global Logistics Ltd.',
    gstinOrTaxId: '27AAACA1234A1Z1', // Maharashtra (Inter-state from Telangana -> IGST)
    billingAddress: {
      street: '12 Nariman Point, Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400021',
      country: 'India',
    },
    creditLimit: 500000,
    outstandingBalance: 0,
    tags: ['Enterprise', 'Logistics', 'Key Account'],
    customFields: { slaTier: 'Platinum 99.99% Mission Critical' },
    isActive: true,
  });

  const cust2 = await CustomerModel.create({
    organizationId: org._id,
    name: 'Aethelgard FinTech Pvt Ltd',
    email: 'finance@aethelgard.io',
    phone: '+91 91234 56789',
    companyName: 'Aethelgard FinTech',
    gstinOrTaxId: '36BBBBB1111B1Z2', // Telangana (Intra-state -> CGST + SGST)
    billingAddress: {
      street: 'Financial District, Gachibowli',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500032',
      country: 'India',
    },
    creditLimit: 300000,
    outstandingBalance: 0,
    tags: ['FinTech', 'High Growth'],
    customFields: { slaTier: 'Gold 99.9%' },
    isActive: true,
  });

  const cust3 = await CustomerModel.create({
    organizationId: org._id,
    name: 'Horizon Health Analytics',
    email: 'accounts@horizonhealth.co',
    phone: '+91 98450 11223',
    companyName: 'Horizon Health Analytics',
    gstinOrTaxId: '29CCCC2222C1Z3', // Karnataka
    billingAddress: {
      street: 'Indiranagar 100ft Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    },
    creditLimit: 200000,
    outstandingBalance: 0,
    tags: ['Healthcare', 'Tier 2'],
    customFields: { slaTier: 'Standard 99.5%' },
    isActive: true,
  });

  // 7. Generate Sample Invoices with Snapshotting & Calculations
  // Invoice 1: Inter-state Paid Invoice (Apex Logistics)
  const calc1 = calculateInvoice(
    [
      {
        productId: String(prod1._id),
        sku: prod1.sku,
        description: prod1.name,
        unit: prod1.unit,
        quantity: 2,
        unitPrice: prod1.unitPrice,
        taxRate: prod1.taxRate,
        hsnSacCode: prod1.hsnSacCode,
      },
      {
        productId: String(prod2._id),
        sku: prod2.sku,
        description: prod2.name,
        unit: prod2.unit,
        quantity: 3,
        unitPrice: prod2.unitPrice,
        taxRate: prod2.taxRate,
        hsnSacCode: prod2.hsnSacCode,
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Telangana',
      destinationState: cust1.billingAddress.state,
    }
  );

  const inv1 = await InvoiceModel.create({
    organizationId: org._id,
    invoiceNumber: 'NEX-2026-1001',
    customerId: cust1._id,
    customerSnapshot: {
      name: cust1.name,
      email: cust1.email,
      phone: cust1.phone,
      companyName: cust1.companyName,
      gstinOrTaxId: cust1.gstinOrTaxId,
      billingAddress: cust1.billingAddress,
    },
    issueDate: '2026-08-01',
    dueDate: '2026-08-16',
    currency: 'INR',
    currencySymbol: '₹',
    items: calc1.items,
    subtotal: calc1.totals.rawSubtotal,
    discountTotal: calc1.totals.totalDiscount,
    taxTotal: calc1.totals.taxTotal,
    taxBreakdown: calc1.totals.taxBreakdown,
    grandTotal: calc1.totals.grandTotal,
    amountPaid: calc1.totals.grandTotal,
    amountDue: 0,
    status: 'paid',
    customFields: { projectCode: 'APX-MUM-2026', billingCycle: 'Monthly' },
    notes: 'Thank you for partnering with Nexus Cloud!',
    createdBy: admin._id,
  });

  // Record Payment for Invoice 1
  await PaymentModel.create({
    organizationId: org._id,
    invoiceId: inv1._id,
    customerId: cust1._id,
    amount: calc1.totals.grandTotal,
    currency: 'INR',
    paymentDate: '2026-08-10',
    paymentMethod: 'bank_transfer',
    transactionReference: 'NEFT-HDFC-9918231',
    status: 'completed',
    notes: 'Settled in full via corporate net banking',
  });

  // Invoice 2: Intra-state Sent Invoice (Aethelgard FinTech)
  const calc2 = calculateInvoice(
    [
      {
        productId: String(prod3._id),
        sku: prod3.sku,
        description: prod3.name,
        unit: prod3.unit,
        quantity: 1,
        unitPrice: prod3.unitPrice,
        taxRate: prod3.taxRate,
        hsnSacCode: prod3.hsnSacCode,
      },
      {
        productId: String(prod4._id),
        sku: prod4.sku,
        description: prod4.name,
        unit: prod4.unit,
        quantity: 1,
        unitPrice: prod4.unitPrice,
        taxRate: prod4.taxRate,
        hsnSacCode: prod4.hsnSacCode,
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Telangana',
      destinationState: cust2.billingAddress.state,
    }
  );

  const inv2 = await InvoiceModel.create({
    organizationId: org._id,
    invoiceNumber: 'NEX-2026-1002',
    customerId: cust2._id,
    customerSnapshot: {
      name: cust2.name,
      email: cust2.email,
      phone: cust2.phone,
      companyName: cust2.companyName,
      gstinOrTaxId: cust2.gstinOrTaxId,
      billingAddress: cust2.billingAddress,
    },
    issueDate: '2026-08-15',
    dueDate: '2026-08-30',
    currency: 'INR',
    currencySymbol: '₹',
    items: calc2.items,
    subtotal: calc2.totals.rawSubtotal,
    discountTotal: calc2.totals.totalDiscount,
    taxTotal: calc2.totals.taxTotal,
    taxBreakdown: calc2.totals.taxBreakdown,
    grandTotal: calc2.totals.grandTotal,
    amountPaid: 50000,
    amountDue: calc2.totals.grandTotal - 50000,
    status: 'partially_paid',
    customFields: { projectCode: 'AETHEL-SOC2-AUDIT', billingCycle: 'One-time' },
    notes: 'Includes initial 50% mobilization advance',
    createdBy: admin._id,
  });

  await PaymentModel.create({
    organizationId: org._id,
    invoiceId: inv2._id,
    customerId: cust2._id,
    amount: 50000,
    currency: 'INR',
    paymentDate: '2026-08-16',
    paymentMethod: 'upi',
    transactionReference: 'UPI-RAZORPAY-883192',
    status: 'completed',
    notes: 'Mobilization advance received',
  });

  await CustomerModel.findByIdAndUpdate(cust2._id, {
    outstandingBalance: calc2.totals.grandTotal - 50000,
  });

  // Invoice 3: Overdue Invoice (Horizon Health Analytics)
  const calc3 = calculateInvoice(
    [
      {
        productId: String(prod1._id),
        sku: prod1.sku,
        description: prod1.name,
        unit: prod1.unit,
        quantity: 1,
        unitPrice: prod1.unitPrice,
        taxRate: prod1.taxRate,
        hsnSacCode: prod1.hsnSacCode,
      },
    ],
    {
      taxSystem: 'GST',
      originState: 'Telangana',
      destinationState: cust3.billingAddress.state,
    }
  );

  await InvoiceModel.create({
    organizationId: org._id,
    invoiceNumber: 'NEX-2026-1003',
    customerId: cust3._id,
    customerSnapshot: {
      name: cust3.name,
      email: cust3.email,
      phone: cust3.phone,
      companyName: cust3.companyName,
      gstinOrTaxId: cust3.gstinOrTaxId,
      billingAddress: cust3.billingAddress,
    },
    issueDate: '2026-07-20',
    dueDate: '2026-08-05',
    currency: 'INR',
    currencySymbol: '₹',
    items: calc3.items,
    subtotal: calc3.totals.rawSubtotal,
    discountTotal: calc3.totals.totalDiscount,
    taxTotal: calc3.totals.taxTotal,
    taxBreakdown: calc3.totals.taxBreakdown,
    grandTotal: calc3.totals.grandTotal,
    amountPaid: 0,
    amountDue: calc3.totals.grandTotal,
    status: 'overdue',
    aiRiskScore: 'HIGH',
    aiRiskExplanation: 'Overdue by 23 days. Follow up required.',
    customFields: { billingCycle: 'Monthly' },
    notes: 'Monthly infrastructure retainer',
    createdBy: admin._id,
  });

  await CustomerModel.findByIdAndUpdate(cust3._id, {
    outstandingBalance: calc3.totals.grandTotal,
  });

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log(`Demo Tenant : ${org.name} (${org.slug})`);
  console.log(`Admin Login : admin@nexuscloud.io / Admin@123456`);
  console.log(`Accountant  : rajesh@nexuscloud.io / Admin@123456`);
  console.log('----------------------------------------------------');
  return { org, admin };
}

export async function autoSeedIfEmpty(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Empty database detected. Auto-seeding initial demo data...');
      await seedDatabase();
      console.log('✨ Auto-seeding completed!');
    }
  } catch (err: any) {
    console.warn('⚠️ Auto-seed check failed:', err.message);
  }
}

export { seedDatabase };

if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
