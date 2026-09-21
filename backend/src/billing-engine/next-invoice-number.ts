import { OrganizationModel } from '../models/Organization.model';
import { ClientSession } from 'mongoose';

export interface ReservedInvoiceNumber {
  invoiceNumber: string;
  sequence: number;
  prefix: string;
}

/**
 * Atomically reserves the next invoice number for an organization.
 *
 * REGRESSION GUARD (BUG-04): the previous pattern —
 *   read org.settings.nextInvoiceNumber → compose number → $inc separately —
 * raced under concurrent invoice/POS/recurring generation and could mint duplicate
 * invoice numbers, violating the unique (organizationId, invoiceNumber) index and
 * crashing one of the concurrent writers. A single findOneAndUpdate with an
 * aggregation-pipeline $set is atomic server-side, so every caller gets a unique
 * sequence. The pre-update document is returned (new: false), so no scratch fields
 * are written.
 */
export async function reserveInvoiceNumber(orgId: string, session?: ClientSession): Promise<ReservedInvoiceNumber> {
  const year = new Date().getFullYear();

  const previous = await OrganizationModel.findOneAndUpdate(
    { _id: orgId },
    [
      {
        $set: {
          'settings.nextInvoiceNumber': {
            $add: [{ $ifNull: ['$settings.nextInvoiceNumber', 1001] }, 1],
          },
        },
      },
    ],
    {
      session,
      projection: { 'settings.invoicePrefix': 1, 'settings.nextInvoiceNumber': 1 },
    }
  );

  if (!previous) {
    throw new Error('Organization not found while reserving invoice number');
  }

  const sequence = Number(previous.settings?.nextInvoiceNumber) || 1001;
  const prefix = previous.settings?.invoicePrefix || 'INV';

  return { invoiceNumber: `${prefix}-${year}-${sequence}`, sequence, prefix };
}
