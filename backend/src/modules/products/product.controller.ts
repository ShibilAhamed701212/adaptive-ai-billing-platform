import { Request, Response, NextFunction } from 'express';
import { ProductModel } from '../../models/Product.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { validateCustomFields } from '../../dynamic-engine/custom-fields/field-validator';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { search, page = 1, limit = 50, type } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId), isActive: true };
    if (type) {
      query.type = type;
    }
    if (search) {
      const searchStr = String(search).trim();
      query.$or = [
        { name: { $regex: searchStr, $options: 'i' } },
        { sku: { $regex: searchStr, $options: 'i' } },
        { description: { $regex: searchStr, $options: 'i' } },
        { barcode: { $regex: searchStr, $options: 'i' } },
        { barcodes: searchStr },
        { category: { $regex: searchStr, $options: 'i' } },
        { brand: { $regex: searchStr, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      ProductModel.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      ProductModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasMore: skip + products.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const product = await ProductModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function getProductByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const barcode = String(req.params.barcode).trim();

    const product = await ProductModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isActive: true,
      $or: [
        { barcode: barcode },
        { barcodes: barcode },
        { sku: barcode.toUpperCase() },
      ],
    });

    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Product not found for barcode: ${barcode}` } });
      return;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const {
      name,
      sku,
      description,
      type,
      unit,
      unitPrice,
      costPrice,
      taxRate,
      hsnSacCode,
      pricingTiers,
      customFields,
      barcode,
      barcodes,
      mrp,
      batchNumber,
      expiryDate,
      category,
      brand,
      isGstInclusive,
      stockQuantity,
      lowStockThreshold,
      manageInventory,
    } = req.body;

    // Check SKU Uniqueness within Org
    const existingSku = await ProductModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      sku: sku.toUpperCase().trim(),
    });
    if (existingSku) {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_SKU', message: 'A product with this SKU already exists' } });
      return;
    }

    // Check Barcode Uniqueness within Org if provided
    if (barcode) {
      const existingBarcode = await ProductModel.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        $or: [{ barcode: barcode.trim() }, { barcodes: barcode.trim() }],
      });
      if (existingBarcode) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE_BARCODE', message: 'A product with this barcode already exists' } });
        return;
      }
    }

    if (customFields) {
      const fieldDefs = await CustomFieldModel.find({ organizationId: orgId, targetEntity: 'product' }).lean();
      const validation = validateCustomFields(fieldDefs, customFields);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: { code: 'CUSTOM_FIELD_ERROR', message: 'Custom field validation failed', details: validation.errors },
        });
        return;
      }
    }

    const allBarcodes: string[] = [];
    if (barcode) allBarcodes.push(barcode.trim());
    if (Array.isArray(barcodes)) {
      barcodes.forEach((b: string) => {
        if (b && !allBarcodes.includes(b.trim())) allBarcodes.push(b.trim());
      });
    }

    const product = await ProductModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name: name.trim(),
      sku: sku.toUpperCase().trim(),
      description,
      type: type || 'goods',
      unit: unit || 'unit',
      unitPrice: Number(unitPrice),
      costPrice: Number(costPrice) || 0,
      taxRate: Number(taxRate) !== undefined ? Number(taxRate) : 0.18,
      hsnSacCode,
      pricingTiers: pricingTiers || [],
      customFields: customFields || {},
      isActive: true,
      barcode: barcode ? barcode.trim() : undefined,
      barcodes: allBarcodes,
      mrp: mrp !== undefined ? Number(mrp) : undefined,
      batchNumber,
      expiryDate,
      category,
      brand,
      isGstInclusive: Boolean(isGstInclusive),
      stockQuantity: Number(stockQuantity) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      manageInventory: Boolean(manageInventory),
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_PRODUCT',
      entityType: 'Product',
      entityId: String(product._id),
      details: { sku: product.sku, name: product.name },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { customFields } = req.body;

    if (customFields) {
      const fieldDefs = await CustomFieldModel.find({ organizationId: orgId, targetEntity: 'product' }).lean();
      const validation = validateCustomFields(fieldDefs, customFields);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: { code: 'CUSTOM_FIELD_ERROR', message: 'Custom field validation failed', details: validation.errors },
        });
        return;
      }
    }

    const product = await ProductModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true }
    );

    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const product = await ProductModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    res.json({ success: true, message: 'Product deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
