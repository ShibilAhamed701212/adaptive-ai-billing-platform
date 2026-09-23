import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { OrganizationModel } from './models/Organization.model';
import { UserModel } from './models/User.model';
import { MembershipModel } from './models/Membership.model';
import { CustomerModel } from './models/Customer.model';
import { ProductModel } from './models/Product.model';
import { InvoiceModel } from './models/Invoice.model';
import { PaymentModel } from './models/Payment.model';
import { ExpenseModel } from './models/Expense.model';
import { SupplierModel } from './models/Supplier.model';
import { PlanModel } from './models/Plan.model';
import { SubscriptionModel } from './models/Subscription.model';
import { ProjectModel } from './models/Project.model';
import { TimesheetModel } from './models/Timesheet.model';
import { RetainerModel } from './models/Retainer.model';
import { ReturnModel } from './models/Return.model';
import { ShiftModel } from './models/Shift.model';
import { calculateInvoice } from './billing-engine/calculators/invoice-calculator';
import { ENV } from './config/env';

/** Helper to generate dates relative to today */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function seedDatabase() {
  console.log('🌱 Starting Rich Multi-Month Analytics Database Population into MongoDB...');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(ENV.MONGODB_URI);
  }

  // Clear existing collections completely to reset demo data cleanly
  await Promise.all([
    OrganizationModel.deleteMany({}),
    UserModel.deleteMany({}),
    CustomerModel.deleteMany({}),
    ProductModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    ExpenseModel.deleteMany({}),
    MembershipModel.deleteMany({}),
    SupplierModel.deleteMany({}),
    PlanModel.deleteMany({}),
    SubscriptionModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TimesheetModel.deleteMany({}),
    RetainerModel.deleteMany({}),
    ReturnModel.deleteMany({}),
    ShiftModel.deleteMany({}),
  ]);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123456', salt);

  // ==========================================
  // 1. RETAIL / SUPERMARKET (FreshMart Supermarket)
  // ==========================================
  console.log('Creating Retail Tenant & Populating 12-Month Analytics...');
  const orgRetail = await OrganizationModel.create({
    name: 'FreshMart Supermarket',
    slug: 'freshmart',
    billingModel: 'retail',
    businessType: 'retail',
    isOnboarded: true,
    enabledModules: ['pos', 'inventory', 'products', 'customers', 'invoices', 'payments', 'suppliers', 'purchases', 'returns', 'shifts', 'expenses', 'reports', 'ai_copilot'],
    settings: { currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', taxSystem: 'GST', invoicePrefix: 'RET', nextInvoiceNumber: 2000 }
  });
  const retailAdmin = await UserModel.create({ organizationId: orgRetail._id, name: 'Retail Admin', email: 'admin@retail.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: retailAdmin._id, organizationId: orgRetail._id, role: 'admin', status: 'active' });

  // Retail Products
  const retailProductsData = [
    { name: 'Basmati Rice 5kg', sku: 'RICE-01', unitPrice: 450, costPrice: 350, stock: 85 },
    { name: 'Full Cream Milk 1L', sku: 'MILK-01', unitPrice: 65, costPrice: 48, stock: 15 },
    { name: 'Whole Wheat Bread 400g', sku: 'BRD-01', unitPrice: 45, costPrice: 32, stock: 8 },
    { name: 'Filter Coffee Powder 500g', sku: 'COF-01', unitPrice: 280, costPrice: 190, stock: 60 },
    { name: 'Herbal Soap 3-Pack', sku: 'SOAP-01', unitPrice: 135, costPrice: 90, stock: 120 },
    { name: 'Anti-Dandruff Shampoo 400ml', sku: 'SHMP-01', unitPrice: 360, costPrice: 240, stock: 45 },
    { name: 'Digestive Biscuits 200g', sku: 'BISC-01', unitPrice: 35, costPrice: 22, stock: 200 },
    { name: 'Sunflower Cooking Oil 1L', sku: 'OIL-01', unitPrice: 185, costPrice: 145, stock: 50 },
    { name: 'Organic Honey 500g', sku: 'HNY-01', unitPrice: 320, costPrice: 220, stock: 30 },
    { name: 'Green Tea 100 Bags', sku: 'TEA-01', unitPrice: 240, costPrice: 160, stock: 75 },
  ];
  const createdRetailProducts = [];
  for (const p of retailProductsData) {
    createdRetailProducts.push(await ProductModel.create({
      organizationId: orgRetail._id,
      name: p.name, sku: p.sku, type: 'goods', unit: 'pcs',
      unitPrice: p.unitPrice, costPrice: p.costPrice,
      manageInventory: true, stockQuantity: p.stock, lowStockThreshold: 20, taxRate: 0.05, isActive: true
    }));
  }

  // Retail Customers & Suppliers
  const retailCustomers = [];
  const customerNames = ['Rahul Sharma', 'Priya Patel', 'Amit Verma', 'Sneha Reddy', 'Vikram Singh', 'Ananya Gupta', 'Deepak Kumar', 'Kavita Joshi', 'Rohan Iyer', 'Meera Nair', 'Suresh Menon', 'Pooja Agarwal', 'Rajesh Rao', 'Divya Shah', 'Arjun Kapoor'];
  for (let i = 0; i < customerNames.length; i++) {
    retailCustomers.push(await CustomerModel.create({
      organizationId: orgRetail._id, name: customerNames[i], email: `customer${i + 1}@freshmart.test`, phone: `+91 98765 ${10000 + i}`, status: 'active'
    }));
  }
  for (let i = 1; i <= 5; i++) {
    await SupplierModel.create({ organizationId: orgRetail._id, name: `FMCG Distributor ${i}`, email: `supply${i}@freshmart.test`, status: 'active' });
  }

  // Historical Expenses for Retail (Past 12 Months)
  const expenseCategories = ['Rent & Lease', 'Electricity & Utilities', 'Staff Salaries', 'Store Logistics', 'Marketing & Promotions', 'Equipment Maintenance'];
  for (let m = 0; m < 12; m++) {
    const daysOffset = m * 30 + randomInt(1, 28);
    const expDate = daysAgo(daysOffset);
    await ExpenseModel.create({
      organizationId: orgRetail._id,
      userId: retailAdmin._id,
      category: expenseCategories[m % expenseCategories.length],
      amount: randomInt(12000, 45000),
      date: expDate.toISOString().split('T')[0],
      description: `Store Operating Expense - ${expenseCategories[m % expenseCategories.length]}`
    });
  }

  // Historical Invoices & Payments for Retail (Past 12 Months: ~60 Invoices)
  let retailInvoiceNumber = 1001;
  for (let m = 0; m < 12; m++) {
    const invoicesInMonth = randomInt(4, 7);
    for (let j = 0; j < invoicesInMonth; j++) {
      const daysBack = m * 30 + randomInt(1, 28);
      const issueD = daysAgo(daysBack);
      const dueD = new Date(issueD);
      dueD.setDate(dueD.getDate() + 15);

      const cust = retailCustomers[randomInt(0, retailCustomers.length - 1)];
      const prod1 = createdRetailProducts[randomInt(0, createdRetailProducts.length - 1)];
      const prod2 = createdRetailProducts[randomInt(0, createdRetailProducts.length - 1)];

      const isHighDiscount = j === 0 && m % 3 === 0;
      const discountPct = isHighDiscount ? 25 : (j % 4 === 0 ? 5 : 0);

      const items = [
        { productId: String(prod1._id), sku: prod1.sku, description: prod1.name, unit: 'pcs', quantity: randomInt(2, 6), unitPrice: prod1.unitPrice, discountPercentage: discountPct, taxRate: 0.05 },
        { productId: String(prod2._id), sku: prod2.sku, description: prod2.name, unit: 'pcs', quantity: randomInt(1, 4), unitPrice: prod2.unitPrice, taxRate: 0.05 }
      ];

      const calc = calculateInvoice(items, { taxSystem: 'GST' });
      
      const isOverdue = daysBack > 15 && (j % 5 === 0);
      const isPaid = !isOverdue && (j % 6 !== 0);
      const status = isPaid ? 'paid' : (isOverdue ? 'overdue' : 'sent');
      const amountPaid = isPaid ? calc.totals.grandTotal : 0;
      const amountDue = isPaid ? 0 : calc.totals.grandTotal;

      const inv = await InvoiceModel.create({
        organizationId: orgRetail._id,
        invoiceNumber: `RET-${retailInvoiceNumber++}`,
        customerId: cust._id,
        customerSnapshot: { name: cust.name, email: cust.email },
        issueDate: issueD.toISOString().split('T')[0],
        dueDate: dueD.toISOString().split('T')[0],
        currency: 'INR', currencySymbol: '₹',
        items: calc.items,
        subtotal: calc.totals.rawSubtotal,
        discountTotal: calc.totals.totalDiscount,
        taxTotal: calc.totals.taxTotal,
        grandTotal: calc.totals.grandTotal,
        amountPaid, amountDue, status,
        aiRiskScore: isOverdue ? 'HIGH' : 'LOW',
        aiRiskExplanation: isOverdue ? `Payment for ${cust.name} delayed past terms.` : undefined,
        createdBy: retailAdmin._id,
        createdAt: issueD
      });

      if (isPaid) {
        const payDate = new Date(issueD);
        payDate.setDate(payDate.getDate() + randomInt(1, 4));
        await PaymentModel.create({
          organizationId: orgRetail._id, invoiceId: inv._id, customerId: cust._id,
          amount: calc.totals.grandTotal, currency: 'INR', paymentDate: payDate.toISOString().split('T')[0],
          paymentMethod: j % 2 === 0 ? 'upi' : 'card', status: 'completed', createdAt: payDate
        });
      } else if (isOverdue) {
        await CustomerModel.findByIdAndUpdate(cust._id, { $inc: { outstandingBalance: calc.totals.grandTotal } });
      }
    }
  }


  // ==========================================
  // 2. SAAS / SUBSCRIPTION (CloudSync SaaS)
  // ==========================================
  console.log('Creating SaaS Tenant & Populating Subscription Analytics...');
  const orgSaas = await OrganizationModel.create({
    name: 'CloudSync SaaS', slug: 'cloudsync', billingModel: 'subscription', businessType: 'saas', isOnboarded: true,
    enabledModules: ['plans', 'subscriptions', 'customers', 'invoices', 'payments', 'expenses', 'reports', 'ai_copilot'],
    settings: { currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', taxSystem: 'NONE', invoicePrefix: 'CSYNC', nextInvoiceNumber: 3000 }
  });
  const saasAdmin = await UserModel.create({ organizationId: orgSaas._id, name: 'SaaS Admin', email: 'admin@saas.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: saasAdmin._id, organizationId: orgSaas._id, role: 'admin', status: 'active' });

  // SaaS Plans
  const starterPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Starter Plan', price: 49, billingInterval: 'monthly', features: ['Up to 5 Users', '10GB Storage'], isActive: true });
  const proPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Professional Plan', price: 149, billingInterval: 'monthly', features: ['Up to 25 Users', '500GB Storage', '24/7 Support'], isActive: true });
  const entPlan = await PlanModel.create({ organizationId: orgSaas._id, name: 'Enterprise Plan', price: 1200, billingInterval: 'yearly', features: ['Unlimited Users', 'Dedicated Instance'], isActive: true });

  // SaaS Customers & Subscriptions
  const saasCompanyNames = ['AcroTech Solutions', 'DevPulse Networks', 'CyberNet Dynamics', 'ScaleUp Labs', 'Vanguard Media', 'Apex Cloud Co', 'OmniData Systems', 'Starlight Media', 'Nexus Digital', 'BlueWave AI', 'Hyperion Tech', 'Quantum Analytics', 'InfiniCloud', 'Zenith Systems', 'Optima Software'];
  const saasCustomers = [];
  for (let i = 0; i < saasCompanyNames.length; i++) {
    const cust = await CustomerModel.create({
      organizationId: orgSaas._id, name: saasCompanyNames[i], email: `contact@${saasCompanyNames[i].toLowerCase().replace(/ /g, '')}.com`, status: 'active'
    });
    saasCustomers.push(cust);

    const plan = i % 4 === 0 ? entPlan : (i % 2 === 0 ? proPlan : starterPlan);
    const subStatus = i === 1 ? 'trialing' : (i === 3 ? 'past_due' : (i === 5 ? 'canceled' : 'active'));
    
    await SubscriptionModel.create({
      organizationId: orgSaas._id, customerId: cust._id, planId: plan._id,
      startDate: daysAgo(i * 20 + 10),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: subStatus,
      trialEnd: subStatus === 'trialing' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined
    });
  }

  // SaaS Expenses (Past 12 Months)
  const saasExpCats = ['AWS Cloud Hosting', 'Stripe Gateway Fees', 'Google Workspace', 'SaaS Marketing & PPC', 'Engineering Contractors', 'Customer Support Tools'];
  for (let m = 0; m < 12; m++) {
    const d = daysAgo(m * 30 + 12);
    await ExpenseModel.create({
      organizationId: orgSaas._id,
      userId: saasAdmin._id,
      category: saasExpCats[m % saasExpCats.length],
      amount: randomInt(800, 3500),
      date: d.toISOString().split('T')[0],
      description: `SaaS Infrastructure - ${saasExpCats[m % saasExpCats.length]}`
    });
  }

  // SaaS Invoices (Past 12 Months)
  let saasInvNum = 2001;
  for (let m = 0; m < 12; m++) {
    for (let c = 0; c < 3; c++) {
      const daysBack = m * 30 + randomInt(2, 26);
      const issueD = daysAgo(daysBack);
      const dueD = new Date(issueD);
      dueD.setDate(dueD.getDate() + 14);

      const cust = saasCustomers[(m * 3 + c) % saasCustomers.length];
      const plan = c % 3 === 0 ? proPlan : starterPlan;

      const calc = calculateInvoice([{ productId: String(plan._id), sku: 'PLAN', description: `${plan.name} Subscription`, unit: 'month', quantity: 1, unitPrice: plan.price, taxRate: 0 }], { taxSystem: 'NONE' });
      
      const isPaid = m > 0 || c !== 0;
      const status = isPaid ? 'paid' : 'sent';

      const inv = await InvoiceModel.create({
        organizationId: orgSaas._id,
        invoiceNumber: `CSYNC-${saasInvNum++}`,
        customerId: cust._id,
        customerSnapshot: { name: cust.name, email: cust.email },
        issueDate: issueD.toISOString().split('T')[0],
        dueDate: dueD.toISOString().split('T')[0],
        currency: 'USD', currencySymbol: '$',
        items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
        amountPaid: isPaid ? calc.totals.grandTotal : 0,
        amountDue: isPaid ? 0 : calc.totals.grandTotal,
        status, createdBy: saasAdmin._id, createdAt: issueD
      });

      if (isPaid) {
        await PaymentModel.create({
          organizationId: orgSaas._id, invoiceId: inv._id, customerId: cust._id,
          amount: calc.totals.grandTotal, currency: 'USD', paymentDate: issueD.toISOString().split('T')[0],
          paymentMethod: 'credit_card', status: 'completed', createdAt: issueD
        });
      } else {
        await CustomerModel.findByIdAndUpdate(cust._id, { $inc: { outstandingBalance: calc.totals.grandTotal } });
      }
    }
  }


  // ==========================================
  // 3. AGENCY / SERVICES (Creativa Agency)
  // ==========================================
  console.log('Creating Agency Tenant & Populating Project & Retainer Data...');
  const orgAgency = await OrganizationModel.create({
    name: 'Creativa Agency', slug: 'creativa', billingModel: 'professional_services', businessType: 'services', isOnboarded: true,
    enabledModules: ['customers', 'projects', 'services', 'timesheets', 'expenses', 'invoices', 'payments', 'retainers', 'reports', 'ai_copilot'],
    settings: { currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Paris', taxSystem: 'VAT', invoicePrefix: 'CRV', nextInvoiceNumber: 4000 }
  });
  const agencyAdmin = await UserModel.create({ organizationId: orgAgency._id, name: 'Agency Admin', email: 'admin@agency.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: agencyAdmin._id, organizationId: orgAgency._id, role: 'admin', status: 'active' });

  // Agency Clients, Projects & Retainers
  const agencyClientsData = ['Luxe Fashion Paris', 'Bistro Lumière', 'Élite Auto Europe', 'Nordic Design Co', 'Horizon Venture Tech', 'Monaco Real Estate', 'Verde Organics', 'Solaria Tech'];
  let agencyInvNum = 3001;

  for (let i = 0; i < agencyClientsData.length; i++) {
    const client = await CustomerModel.create({ organizationId: orgAgency._id, name: agencyClientsData[i], email: `info@${agencyClientsData[i].toLowerCase().replace(/ /g, '')}.com` });
    const proj = await ProjectModel.create({ organizationId: orgAgency._id, clientId: client._id, name: `${agencyClientsData[i]} - Full Rebrand`, status: 'active', hourlyRate: 160 });

    // Timesheets
    await TimesheetModel.create({ organizationId: orgAgency._id, projectId: proj._id, userId: agencyAdmin._id, date: daysAgo(5), hours: 14, description: 'UI/UX Wireframes & Prototypes', isBillable: true, status: 'draft' });
    await TimesheetModel.create({ organizationId: orgAgency._id, projectId: proj._id, userId: agencyAdmin._id, date: daysAgo(12), hours: 6, description: 'Brand Discovery & Strategy Session', isBillable: true, status: 'approved' });
    
    // Retainers
    if (i % 3 === 0) {
      await RetainerModel.create({ organizationId: orgAgency._id, clientId: client._id, amount: 4500, remainingBalance: 2800, billingPeriod: 'monthly', status: 'active' });
    }

    // Historical Invoices across months
    for (let m = 0; m < 6; m++) {
      const issueD = daysAgo(m * 30 + randomInt(5, 25));
      const dueD = new Date(issueD);
      dueD.setDate(dueD.getDate() + 30);

      const calc = calculateInvoice([{ sku: 'DESIGN-HR', description: 'Design & Engineering Services', unit: 'hr', quantity: 20 + m * 5, unitPrice: 160, taxRate: 0.20 }], { taxSystem: 'VAT' });
      
      const isPaid = m > 0;
      const status = isPaid ? 'paid' : 'sent';

      const inv = await InvoiceModel.create({
        organizationId: orgAgency._id, invoiceNumber: `CRV-${agencyInvNum++}`, customerId: client._id,
        customerSnapshot: { name: client.name, email: client.email },
        issueDate: issueD.toISOString().split('T')[0], dueDate: dueD.toISOString().split('T')[0],
        currency: 'EUR', currencySymbol: '€',
        items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
        amountPaid: isPaid ? calc.totals.grandTotal : 0, amountDue: isPaid ? 0 : calc.totals.grandTotal,
        status, createdBy: agencyAdmin._id, createdAt: issueD
      });

      if (isPaid) {
        await PaymentModel.create({
          organizationId: orgAgency._id, invoiceId: inv._id, customerId: client._id,
          amount: calc.totals.grandTotal, currency: 'EUR', paymentDate: issueD.toISOString().split('T')[0],
          paymentMethod: 'bank_transfer', status: 'completed', createdAt: issueD
        });
      } else {
        await CustomerModel.findByIdAndUpdate(client._id, { $inc: { outstandingBalance: calc.totals.grandTotal } });
      }
    }
  }

  // Agency Expenses
  const agencyExpenses = ['Figma & Adobe Enterprise', 'Freelance Copywriter', 'Client Hosting & Domain', 'Co-working Space Paris', 'Travel & Onsite Meetings'];
  for (let m = 0; m < 12; m++) {
    const d = daysAgo(m * 30 + 10);
    await ExpenseModel.create({
      organizationId: orgAgency._id,
      userId: agencyAdmin._id,
      category: agencyExpenses[m % agencyExpenses.length],
      amount: randomInt(600, 2800),
      date: d.toISOString().split('T')[0],
      description: `Agency Expense - ${agencyExpenses[m % agencyExpenses.length]}`
    });
  }


  // ==========================================
  // 4. GENERAL BUSINESS (Acme Corp)
  // ==========================================
  console.log('Creating General Tenant & Populating Billing Data...');
  const orgGen = await OrganizationModel.create({
    name: 'Acme Corp', slug: 'acme', billingModel: 'custom', businessType: 'general', isOnboarded: true,
    enabledModules: ['products', 'customers', 'invoices', 'payments', 'expenses', 'reports', 'ai_copilot'],
    settings: { currency: 'USD', currencySymbol: '$', timezone: 'America/Los_Angeles', taxSystem: 'SALES_TAX', invoicePrefix: 'ACM', nextInvoiceNumber: 5000 }
  });
  const genAdmin = await UserModel.create({ organizationId: orgGen._id, name: 'Gen Admin', email: 'admin@general.test', passwordHash, role: 'admin', isActive: true });
  await MembershipModel.create({ userId: genAdmin._id, organizationId: orgGen._id, role: 'admin', status: 'active' });

  let genInvNum = 4001;
  for (let i = 1; i <= 10; i++) {
    const cust = await CustomerModel.create({ organizationId: orgGen._id, name: `Corporate Client ${i}`, email: `client${i}@acme.test` });
    
    for (let m = 0; m < 6; m++) {
      const issueD = daysAgo(m * 30 + randomInt(3, 27));
      const dueD = new Date(issueD);
      dueD.setDate(dueD.getDate() + 30);

      const calc = calculateInvoice([{ sku: 'CONSULT-01', description: 'Enterprise Advisory & Integration', unit: 'hr', quantity: 15, unitPrice: 220, taxRate: 0.10 }], { taxSystem: 'SALES_TAX' });
      const isPaid = m > 0;

      const inv = await InvoiceModel.create({
        organizationId: orgGen._id, invoiceNumber: `ACM-${genInvNum++}`, customerId: cust._id, customerSnapshot: { name: cust.name, email: cust.email },
        issueDate: issueD.toISOString().split('T')[0], dueDate: dueD.toISOString().split('T')[0],
        currency: 'USD', currencySymbol: '$',
        items: calc.items, subtotal: calc.totals.rawSubtotal, taxTotal: calc.totals.taxTotal, grandTotal: calc.totals.grandTotal,
        amountPaid: isPaid ? calc.totals.grandTotal : 0, amountDue: isPaid ? 0 : calc.totals.grandTotal,
        status: isPaid ? 'paid' : 'sent', createdBy: genAdmin._id, createdAt: issueD
      });

      if (isPaid) {
        await PaymentModel.create({
          organizationId: orgGen._id, invoiceId: inv._id, customerId: cust._id,
          amount: calc.totals.grandTotal, currency: 'USD', paymentDate: issueD.toISOString().split('T')[0],
          paymentMethod: 'bank_transfer', status: 'completed', createdAt: issueD
        });
      } else {
        await CustomerModel.findByIdAndUpdate(cust._id, { $inc: { outstandingBalance: calc.totals.grandTotal } });
      }
    }
  }

  // General Expenses
  for (let m = 0; m < 12; m++) {
    const d = daysAgo(m * 30 + 15);
    await ExpenseModel.create({
      organizationId: orgGen._id,
      userId: genAdmin._id,
      category: 'Operations',
      amount: randomInt(1500, 6000),
      date: d.toISOString().split('T')[0],
      description: `General Operations Expense`
    });
  }

  console.log('✅ Direct MongoDB Multi-Month Analytics Seeding Completed Successfully!');
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
      console.log('🌱 Empty database detected. Auto-seeding initial demo data into MongoDB...');
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
