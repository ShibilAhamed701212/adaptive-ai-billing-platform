import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ProductModel } from '../../models/Product.model';
import { CustomerModel } from '../../models/Customer.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { PaymentModel } from '../../models/Payment.model';
import { SupplierModel } from '../../models/Supplier.model';
import { PurchaseModel } from '../../models/Purchase.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function exportTenantBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const orgObjId = new mongoose.Types.ObjectId(orgId);

    const [products, customers, invoices, payments, suppliers, purchases] = await Promise.all([
      ProductModel.find({ organizationId: orgObjId }).lean(),
      CustomerModel.find({ organizationId: orgObjId }).lean(),
      InvoiceModel.find({ organizationId: orgObjId }).lean(),
      PaymentModel.find({ organizationId: orgObjId }).lean(),
      SupplierModel.find({ organizationId: orgObjId }).lean(),
      PurchaseModel.find({ organizationId: orgObjId }).lean(),
    ]);

    const backupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      organizationId: orgId,
      counts: {
        products: products.length,
        customers: customers.length,
        invoices: invoices.length,
        payments: payments.length,
        suppliers: suppliers.length,
        purchases: purchases.length,
      },
      data: {
        products,
        customers,
        invoices,
        payments,
        suppliers,
        purchases,
      },
    };

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'EXPORT_BACKUP',
      entityType: 'System',
      entityId: orgId,
      details: { counts: backupPayload.counts },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup-${orgId}-${Date.now()}.json`);
    res.json({ success: true, data: backupPayload });
  } catch (err) {
    next(err);
  }
}

export async function restoreTenantBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.tenant!.organizationId;
    const orgObjId = new mongoose.Types.ObjectId(orgId);
    const { backup } = req.body;

    if (!backup || !backup.data) {
      res.status(400).json({ success: false, error: { code: 'INVALID_BACKUP', message: 'Valid backup payload is required' } });
      return;
    }

    const { products = [], customers = [], suppliers = [] } = backup.data;

    let restoredProducts = 0;
    for (const p of products) {
      await ProductModel.findOneAndUpdate(
        { organizationId: orgObjId, sku: p.sku },
        { ...p, organizationId: orgObjId },
        { upsert: true, session }
      );
      restoredProducts++;
    }

    let restoredCustomers = 0;
    for (const c of customers) {
      await CustomerModel.findOneAndUpdate(
        { organizationId: orgObjId, email: c.email },
        { ...c, organizationId: orgObjId },
        { upsert: true, session }
      );
      restoredCustomers++;
    }

    let restoredSuppliers = 0;
    for (const s of suppliers) {
      await SupplierModel.findOneAndUpdate(
        { organizationId: orgObjId, name: s.name },
        { ...s, organizationId: orgObjId },
        { upsert: true, session }
      );
      restoredSuppliers++;
    }

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'RESTORE_BACKUP',
      entityType: 'System',
      entityId: orgId,
      details: { restoredProducts, restoredCustomers, restoredSuppliers },
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Tenant backup restored successfully',
      restored: { products: restoredProducts, customers: restoredCustomers, suppliers: restoredSuppliers },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}

export async function reseedAnalyticsData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { seedDatabase } = await import('../../seed');
    await seedDatabase();
    res.json({
      success: true,
      message: 'MongoDB collections successfully populated with 12-month analytics and historical financial data!',
    });
  } catch (err) {
    next(err);
  }
}
