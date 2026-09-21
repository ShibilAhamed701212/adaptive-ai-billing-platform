import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { OrganizationModel } from './models/Organization.model';
import { UserModel } from './models/User.model';
import { MembershipModel } from './models/Membership.model';
import { CustomerModel } from './models/Customer.model';
import { ProductModel } from './models/Product.model';
import { InvoiceModel } from './models/Invoice.model';
import { PaymentModel } from './models/Payment.model';
import { SupplierModel } from './models/Supplier.model';
import { PlanModel } from './models/Plan.model';
import { SubscriptionModel } from './models/Subscription.model';
import { ProjectModel } from './models/Project.model';
import { TimesheetModel } from './models/Timesheet.model';
import { RetainerModel } from './models/Retainer.model';
import { calculateInvoice } from './billing-engine/calculators/invoice-calculator';
import { ENV } from './config/env';

export async function seedDatabase() {
  console.log('🌱 Starting Genuine Multi-Business-Type Database Seeding...');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(ENV.MONGODB_URI);
  }

  // Clear existing collections completely to reset demo data safely
  await Promise.all([
    OrganizationModel.deleteMany({}),
    UserModel.deleteMany({}),
    CustomerModel.deleteMany({}),
    ProductModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    MembershipModel.deleteMany({}),
    SupplierModel.deleteMany({}),
    PlanModel.deleteMany({}),
    SubscriptionModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TimesheetModel.deleteMany({}),
    RetainerModel.deleteMany({}),
  ]);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123456', salt);

  // ==========================================
  // 1. RETAIL / SUPERMARKET (Demo Retail Store)
  // ==========================================
  console.log('Creating Retail Tenant...');
  const orgRetail = await OrganizationModel.create({
    name: 'FreshMart Supermarket',
    slug: 'freshmart',
    billingModel: 'retail',
    businessType: 'retail',
    isOnboarded: true,
    enabledModules: ['pos', 'inventory', 'products', 'customers', 'sales', 'invoices', 'payments', 'suppliers', 'reports', 'settings', 'ai_copilot'],
    settings: { currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', taxSystem: 'GST', invoicePrefix: 'RET', nextInvoiceNumber: 1001 }
  });
  const retailAdmin = await UserModel.create({ organizationId: orgRetail._id, name: 'Retail Admin', email: 'admin@retail.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: retailAdmin._id, organizationId: orgRetail._id, role: 'admin', status: 'active' });

  // Retail Products
  const retailProducts = [
    { name: 'Basmati Rice 5kg', sku: 'RICE-01', unitPrice: 450, costPrice: 380, stock: 45 },
    { name: 'Full Cream Milk 1L', sku: 'MILK-01', unitPrice: 65, costPrice: 50, stock: 12 }, // Low stock
    { name: 'Whole Wheat Bread', sku: 'BRD-01', unitPrice: 40, costPrice: 30, stock: 0 }, // Out of stock
    { name: 'Filter Coffee 500g', sku: 'COF-01', unitPrice: 250, costPrice: 180, stock: 60 },
    { name: 'Herbal Soap 3-pack', sku: 'SOAP-01', unitPrice: 120, costPrice: 90, stock: 100 },
    { name: 'Anti-Dandruff Shampoo 400ml', sku: 'SHMP-01', unitPrice: 350, costPrice: 250, stock: 40 },
    { name: 'Digestive Biscuits 200g', sku: 'BISC-01', unitPrice: 30, costPrice: 20, stock: 150 },
    { name: 'Sunflower Cooking Oil 1L', sku: 'OIL-01', unitPrice: 180, costPrice: 150, stock: 35 },
  ];
  
  const createdRetailProducts = [];
  for (const p of retailProducts) {
    createdRetailProducts.push(await ProductModel.create({
      organizationId: orgRetail._id,
      name: p.name, sku: p.sku, type: 'product', unit: 'pcs',
      unitPrice: p.unitPrice, costPrice: p.costPrice,
      inventory: { trackStock: true, currentStock: p.stock, minStockLevel: 20, allowOversell: false },
      taxRate: 0.05, isActive: true
    }));
  }

  // Retail Customers & Suppliers
  const retailCustomers = [];
  for(let i=1; i<=12; i++) {
    retailCustomers.push(await CustomerModel.create({ organizationId: orgRetail._id, name: `Retail Customer ${i}`, email: `cust${i}@retail.test` }));
  }
  for(let i=1; i<=5; i++) {
    await SupplierModel.create({ organizationId: orgRetail._id, name: `Supplier ${i}`, email: `sup${i}@retail.test`, status: 'active' });
  }

  // Generate 25 Retail Invoices
  for(let i=0; i<25; i++) {
    const cust = retailCustomers[i % retailCustomers.length];
    const prod = createdRetailProducts[i % createdRetailProducts.length];
    
    const calc = calculateInvoice([{ productId: String(prod._id), sku: prod.sku, description: prod.name, unit: 'pcs', quantity: 1 + (i % 3), unitPrice: prod.unitPrice, taxRate: 0.05 }], { taxSystem: 'GST' });
    
    const inv = await InvoiceModel.create({
      organizationId: orgRetail._id, invoiceNumber: `RET-10${i}`, customerId: cust._id,
      customerSnapshot: { name: cust.name, email: cust.email },
      issueDate: new Date(), dueDate: new Date(), currency: 'INR', currencySymbol: '₹',
      items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
      amountPaid: i % 5 === 0 ? 0 : calc.totals.grandTotal, // 1 in 5 unpaid
      amountDue: i % 5 === 0 ? calc.totals.grandTotal : 0,
      status: i % 5 === 0 ? 'sent' : 'paid', createdBy: retailAdmin._id
    });

    if (inv.status === 'paid') {
      await PaymentModel.create({ organizationId: orgRetail._id, invoiceId: inv._id, customerId: cust._id, amount: calc.totals.grandTotal, currency: 'INR', paymentDate: new Date(), paymentMethod: 'cash', status: 'completed' });
    }
  }


  // ==========================================
  // 2. SAAS / SUBSCRIPTION (Demo SaaS Company)
  // ==========================================
  console.log('Creating SaaS Tenant...');
  const orgSaas = await OrganizationModel.create({
    name: 'CloudSync SaaS', slug: 'cloudsync', billingModel: 'subscription', businessType: 'saas', isOnboarded: true,
    enabledModules: ['plans', 'subscriptions', 'customers', 'invoices', 'payments', 'usage', 'revenue', 'churn', 'reports', 'settings', 'ai_copilot'],
    settings: { currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', taxSystem: 'NONE', invoicePrefix: 'CSYNC', nextInvoiceNumber: 2001 }
  });
  const saasAdmin = await UserModel.create({ organizationId: orgSaas._id, name: 'SaaS Admin', email: 'admin@saas.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: saasAdmin._id, organizationId: orgSaas._id, role: 'admin', status: 'active' });

  // SaaS Plans
  const starterPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Starter', price: 29, billingInterval: 'monthly', features: ['Up to 5 users'], isActive: true });
  const proPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Professional', price: 99, billingInterval: 'monthly', features: ['Unlimited users'], isActive: true });
  const entPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Enterprise', price: 990, billingInterval: 'yearly', features: ['24/7 SLA'], isActive: true });

  const saasCustomers = [];
  for(let i=1; i<=15; i++) {
    const cust = await CustomerModel.create({ organizationId: orgSaas._id, name: `Tech Corp ${i}`, email: `tech${i}@saas.test` });
    saasCustomers.push(cust);
    
    // SaaS Subscriptions
    let plan = starterPlan;
    if (i % 3 === 0) plan = proPlan;
    if (i % 5 === 0) plan = entPlan;
    
    let status = 'active';
    if (i === 1) status = 'trialing';
    if (i === 2) status = 'past_due';
    if (i === 3) status = 'canceled';
    
    await SubscriptionModel.create({
      organizationId: orgSaas._id, customerId: cust._id, planId: plan._id,
      startDate: new Date(), renewalDate: new Date(Date.now() + 30*24*60*60*1000),
      status, trialEnd: status === 'trialing' ? new Date(Date.now() + 7*24*60*60*1000) : undefined
    });

    // SaaS Invoices
    const calc = calculateInvoice([{ productId: String(plan._id), sku: 'PLAN', description: plan.name + ' Plan', unit: 'month', quantity: 1, unitPrice: plan.price, taxRate: 0 }], { taxSystem: 'NONE' });
    const inv = await InvoiceModel.create({
      organizationId: orgSaas._id, invoiceNumber: `CSYNC-20${i}`, customerId: cust._id, customerSnapshot: { name: cust.name, email: cust.email },
      issueDate: new Date(), dueDate: new Date(), currency: 'USD', currencySymbol: '$',
      items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
      amountPaid: status === 'active' ? calc.totals.grandTotal : 0,
      amountDue: status === 'active' ? 0 : calc.totals.grandTotal,
      status: status === 'active' ? 'paid' : 'sent', createdBy: saasAdmin._id
    });
  }


  // ==========================================
  // 3. AGENCY / PROFESSIONAL SERVICES (Demo Agency)
  // ==========================================
  console.log('Creating Agency Tenant...');
  const orgAgency = await OrganizationModel.create({
    name: 'Creativa Agency', slug: 'creativa', billingModel: 'professional_services', businessType: 'services', isOnboarded: true,
    enabledModules: ['customers', 'projects', 'services', 'timesheets', 'expenses', 'invoices', 'payments', 'retainers', 'reports', 'settings', 'ai_copilot'],
    settings: { currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Paris', taxSystem: 'VAT', invoicePrefix: 'CRV', nextInvoiceNumber: 3001 }
  });
  const agencyAdmin = await UserModel.create({ organizationId: orgAgency._id, name: 'Agency Admin', email: 'admin@agency.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: agencyAdmin._id, organizationId: orgAgency._id, role: 'admin', status: 'active' });

  // Agency Clients & Projects
  for(let i=1; i<=8; i++) {
    const client = await CustomerModel.create({ organizationId: orgAgency._id, name: `Client Brand ${i}`, email: `hello@brand${i}.test` });
    const proj = await ProjectModel.create({ organizationId: orgAgency._id, clientId: client._id, name: `Website Redesign ${i}`, status: 'active', hourlyRate: 150 });
    
    // Timesheets
    await TimesheetModel.create({ organizationId: orgAgency._id, projectId: proj._id, userId: agencyAdmin._id, date: new Date(), hours: 5, description: 'UX Wireframing', isBillable: true });
    await TimesheetModel.create({ organizationId: orgAgency._id, projectId: proj._id, userId: agencyAdmin._id, date: new Date(), hours: 2, description: 'Client Meeting', isBillable: false });
    
    // Retainers
    if (i % 4 === 0) {
      await RetainerModel.create({ organizationId: orgAgency._id, clientId: client._id, amount: 5000, remainingBalance: 2500, billingPeriod: 'monthly', status: 'active' });
    }

    // Invoices
    const calc = calculateInvoice([{ productId: 'HOURS', sku: 'HR', description: 'UX Wireframing (5 hours)', unit: 'hr', quantity: 5, unitPrice: 150, taxRate: 0.20 }], { taxSystem: 'VAT' });
    await InvoiceModel.create({
      organizationId: orgAgency._id, invoiceNumber: `CRV-30${i}`, customerId: client._id, customerSnapshot: { name: client.name, email: client.email },
      issueDate: new Date(), dueDate: new Date(), currency: 'EUR', currencySymbol: '€',
      items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
      amountPaid: calc.totals.grandTotal, amountDue: 0, status: 'paid', createdBy: agencyAdmin._id
    });
  }


  // ==========================================
  // 4. GENERAL BUSINESS (Demo General Business)
  // ==========================================
  console.log('Creating General Tenant...');
  const orgGen = await OrganizationModel.create({
    name: 'Acme Corp', slug: 'acme', billingModel: 'custom', businessType: 'general', isOnboarded: true,
    enabledModules: ['products', 'customers', 'sales', 'invoices', 'payments', 'expenses', 'reports', 'settings', 'ai_copilot'],
    settings: { currency: 'USD', currencySymbol: '$', timezone: 'America/Los_Angeles', taxSystem: 'SALES_TAX', invoicePrefix: 'ACM', nextInvoiceNumber: 4001 }
  });
  const genAdmin = await UserModel.create({ organizationId: orgGen._id, name: 'Gen Admin', email: 'admin@general.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: genAdmin._id, organizationId: orgGen._id, role: 'admin', status: 'active' });

  for(let i=1; i<=10; i++) {
    const cust = await CustomerModel.create({ organizationId: orgGen._id, name: `General Client ${i}`, email: `client${i}@general.test` });
    const calc = calculateInvoice([{ productId: 'SVC', sku: 'CONSULT', description: 'General Consulting', unit: 'hr', quantity: 10, unitPrice: 200, taxRate: 0.10 }], { taxSystem: 'SALES_TAX' });
    await InvoiceModel.create({
      organizationId: orgGen._id, invoiceNumber: `ACM-40${i}`, customerId: cust._id, customerSnapshot: { name: cust.name, email: cust.email },
      issueDate: new Date(), dueDate: new Date(), currency: 'USD', currencySymbol: '$',
      items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
      amountPaid: 0, amountDue: calc.totals.grandTotal, status: 'sent', createdBy: genAdmin._id
    });
  }

  console.log('✅ Multi-Business Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Retail : admin@retail.test / Admin@123456');
  console.log('SaaS   : admin@saas.test / Admin@123456');
  console.log('Agency : admin@agency.test / Admin@123456');
  console.log('General: admin@general.test / Admin@123456');
  console.log('----------------------------------------------------');
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


if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
