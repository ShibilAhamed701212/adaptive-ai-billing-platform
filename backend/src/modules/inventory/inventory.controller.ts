import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { InventoryMovementModel } from '../../models/InventoryMovement.model';
import { ProductModel } from '../../models/Product.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { productId, type, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (productId) query.productId = new mongoose.Types.ObjectId(String(productId));
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [movements, total] = await Promise.all([
      InventoryMovementModel.find(query)
        .populate('productId', 'name sku barcode unit')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      InventoryMovementModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: movements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { productId, type, quantityChange, notes } = req.body;

    if (!productId || quantityChange === undefined || Number(quantityChange) === 0) {
      throw new Error('Valid productId and non-zero quantityChange are required');
    }

    const validTypes = ['ADJUSTMENT', 'DAMAGE', 'EXPIRY', 'CORRECTION', 'TRANSFER'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid adjustment type. Must be one of: ${validTypes.join(', ')}`);
    }

    const product = await ProductModel.findOne({
      _id: productId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    if (!product) throw new Error('Product not found');

    const previousStock = product.stockQuantity || 0;
    const change = Number(quantityChange);
    const newStock = previousStock + change;

    if (newStock < 0) {
      throw new Error(`Adjustment would result in negative stock (${newStock})`);
    }

    product.stockQuantity = newStock;
    await product.save({ session });

    const movement = new InventoryMovementModel({
      organizationId: new mongoose.Types.ObjectId(orgId),
      productId: product._id,
      userId: new mongoose.Types.ObjectId(userId),
      type,
      quantity: change,
      previousStock,
      newStock,
      notes: notes || `Manual stock adjustment: ${type}`,
    });

    await movement.save({ session });

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'Product',
      entityId: String(product._id),
      details: { sku: product.sku, type, change, previousStock, newStock, notes },
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, data: { product, movement } });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}

export async function getLowStockAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;

    const lowStockProducts = await ProductModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true,
      manageInventory: true,
      $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
    }).sort({ stockQuantity: 1 });

    res.json({
      success: true,
      data: lowStockProducts,
      count: lowStockProducts.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStockValuation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;

    const products = await ProductModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true,
    }).lean();

    let totalUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    for (const p of products) {
      const qty = p.stockQuantity || 0;
      totalUnits += qty;
      totalCostValuation += qty * (p.costPrice || 0);
      totalRetailValuation += qty * (p.unitPrice || 0);
    }

    const estimatedMargin = totalRetailValuation - totalCostValuation;

    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        totalUnits,
        totalCostValuation: Math.round(totalCostValuation * 100) / 100,
        totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
        estimatedMargin: Math.round(estimatedMargin * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
}
