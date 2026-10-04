import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PurchaseModel } from '../../models/Purchase.model';
import { ProductModel } from '../../models/Product.model';
import { SupplierModel } from '../../models/Supplier.model';
import { InventoryMovementModel } from '../../models/InventoryMovement.model';
import { logAuditEvent } from '../../core/audit/audit.service';
import { parsePagination } from '../../core/utils/query';

export async function listPurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { supplierId, status, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (supplierId) query.supplierId = new mongoose.Types.ObjectId(String(supplierId));
    if (status) query.status = String(status);

    const { page: pageNum, limit: pageSize, skip } = parsePagination(page, limit);
    const [purchases, total] = await Promise.all([
      PurchaseModel.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(pageSize),
      PurchaseModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: purchases,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { supplierId, items, purchaseNumber, date, amountPaid = 0, notes, status = 'RECEIVED' } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Supplier ID and items are required');
    }

    const supplier = await SupplierModel.findOne({
      _id: supplierId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    if (!supplier) throw new Error('Supplier not found');

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    const processedItems = [];

    const round2 = (n: number) => Math.round(n * 100) / 100;
    for (const item of items) {
      const qty = Number(item.quantity);
      const cost = Number(item.unitPrice);
      const rate = Number(item.taxRate) || 0;
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0 || rate < 0) {
        throw new Error(`Purchase line ${item.name || item.sku || item.productId} needs a positive quantity and a non-negative cost`);
      }
      const lineSubtotal = round2(qty * cost);
      const lineTax = round2(lineSubtotal * rate);
      const lineTotal = round2(lineSubtotal + lineTax);

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      processedItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate) || 0,
        taxAmount: lineTax,
        lineTotal,
      });
    }

    subtotal = round2(subtotal);
    taxTotal = round2(taxTotal);
    const grandTotal = round2(subtotal + taxTotal);
    const paid = Number(amountPaid);
    if (!Number.isFinite(paid) || paid < 0 || paid > grandTotal + 0.001) {
      throw new Error(`Amount paid must be between 0 and the purchase total (${grandTotal})`);
    }
    const amountDue = round2(Math.max(0, grandTotal - paid));

    const finalPurchaseNumber = purchaseNumber || `PO-${Date.now().toString().slice(-6)}`;

    const purchase = new PurchaseModel({
      organizationId: new mongoose.Types.ObjectId(orgId),
      purchaseNumber: finalPurchaseNumber,
      supplierId: supplier._id,
      date: date || new Date().toISOString().split('T')[0],
      items: processedItems,
      subtotal,
      taxTotal,
      grandTotal,
      amountPaid: Number(amountPaid),
      amountDue,
      status,
      notes,
      userId: new mongoose.Types.ObjectId(userId),
    });

    await purchase.save({ session });

    // If status is RECEIVED, atomically increment inventory and create movement records
    if (status === 'RECEIVED') {
      for (const item of processedItems) {
        const product = await ProductModel.findOne({
          _id: item.productId,
          organizationId: new mongoose.Types.ObjectId(orgId),
        }).session(session);

        // Never record a received line that doesn't land in this tenant's stock.
        if (!product) throw new Error(`Product ${item.name || item.productId} not found in your catalog`);
        {
          const previousStock = product.stockQuantity || 0;
          const newStock = previousStock + item.quantity;
          product.stockQuantity = newStock;
          product.costPrice = item.unitPrice; // update latest cost price
          await product.save({ session });

          const movement = new InventoryMovementModel({
            organizationId: new mongoose.Types.ObjectId(orgId),
            productId: product._id,
            userId: new mongoose.Types.ObjectId(userId),
            type: 'PURCHASE',
            quantity: item.quantity,
            previousStock,
            newStock,
            referenceId: String(purchase._id),
            referenceModel: 'Purchase',
            notes: `Purchase receipt PO #${finalPurchaseNumber}`,
          });
          await movement.save({ session });
        }
      }

      // Update supplier balance if there is unpaid amount
      if (amountDue > 0) {
        supplier.outstandingBalance = (supplier.outstandingBalance || 0) + amountDue;
        await supplier.save({ session });
      }
    }

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_PURCHASE',
      entityType: 'Purchase',
      entityId: String(purchase._id),
      details: { purchaseNumber: finalPurchaseNumber, grandTotal, supplier: supplier.name },
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: purchase });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}
