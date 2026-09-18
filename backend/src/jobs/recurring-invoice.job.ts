import { RecurringProfileModel, IRecurringProfileDoc } from '../models/RecurringProfile.model';
import { InvoiceModel } from '../models/Invoice.model';
import { CustomerModel } from '../models/Customer.model';
import { OrganizationModel } from '../models/Organization.model';
import { calculateInvoice } from '../billing-engine/calculators/invoice-calculator';

export function calculateNextRunDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'semi_annual':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export async function executeRecurringProfileGeneration(profile: IRecurringProfileDoc): Promise<any> {
  const org = await OrganizationModel.findById(profile.organizationId);
  const customer = await CustomerModel.findById(profile.customerId);

  if (!org || !customer) {
    throw new Error('Organization or Customer associated with recurring profile not found');
  }

  // Calculate invoice
  const { items: processedItems, totals } = calculateInvoice(profile.items as any, {
    taxSystem: org.settings.taxSystem,
    originState: org.settings.address?.state,
    destinationState: customer.billingAddress?.state,
    invoiceDiscountAmount: profile.invoiceDiscountAmount,
  });

  // Unique sequential number
  const prefix = org.settings.invoicePrefix || 'INV';
  const nextSeq = org.settings.nextInvoiceNumber || 1001;
  const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${nextSeq}`;
  await OrganizationModel.findByIdAndUpdate(org._id, { $inc: { 'settings.nextInvoiceNumber': 1 } });

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + (org.settings.paymentTermsDays || 30) * 86400000).toISOString().split('T')[0];
  const status = profile.autoSend ? 'sent' : 'draft';

  const invoice = await InvoiceModel.create({
    organizationId: org._id,
    invoiceNumber,
    customerId: customer._id,
    customerSnapshot: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      companyName: customer.companyName,
      gstinOrTaxId: customer.gstinOrTaxId,
      billingAddress: customer.billingAddress,
    },
    issueDate,
    dueDate,
    currency: org.settings.currency || 'INR',
    currencySymbol: org.settings.currencySymbol || '₹',
    items: processedItems,
    subtotal: totals.rawSubtotal,
    discountTotal: totals.totalDiscount,
    taxTotal: totals.taxTotal,
    taxBreakdown: totals.taxBreakdown,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    amountDue: totals.grandTotal,
    status,
    notes: profile.notes || 'Auto-generated recurring subscription invoice',
    terms: profile.terms || `Payment due within ${org.settings.paymentTermsDays || 30} days.`,
    customFields: profile.customFields || {},
    createdBy: profile.createdBy,
  });

  if (status === 'sent') {
    await CustomerModel.findByIdAndUpdate(customer._id, {
      $inc: { outstandingBalance: totals.grandTotal },
    });
  }

  // Advance profile state
  profile.totalGeneratedCount += 1;
  profile.lastRunDate = new Date();
  profile.nextRunDate = calculateNextRunDate(profile.nextRunDate, profile.frequency);

  // Check completion
  if (profile.maxOccurrences && profile.totalGeneratedCount >= profile.maxOccurrences) {
    profile.status = 'completed';
  } else if (profile.endDate && profile.nextRunDate > profile.endDate) {
    profile.status = 'completed';
  }

  await profile.save();
  return invoice;
}

export async function processAllPendingRecurringInvoices(orgId?: string): Promise<{ generatedCount: number; failedCount: number }> {
  const now = new Date();
  const query: any = {
    status: 'active',
    nextRunDate: { $lte: now },
  };
  if (orgId) {
    query.organizationId = orgId;
  }
  const profilesToRun = await RecurringProfileModel.find(query);

  let generatedCount = 0;
  let failedCount = 0;
  for (const profile of profilesToRun) {
    try {
      await executeRecurringProfileGeneration(profile);
      generatedCount++;
    } catch (err) {
      console.error(`Failed to process recurring profile ${profile._id}:`, err);
      failedCount++;
    }
  }
  return { generatedCount, failedCount };
}
