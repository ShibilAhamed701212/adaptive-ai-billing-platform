import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupplierModel } from '../../models/Supplier.model';
import { logAuditEvent } from '../../core/audit/audit.service';
import { parsePagination, containsText } from '../../core/utils/query';

export async function listSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { search, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId), isActive: true };
    if (search) {
      const s = String(search).trim();
      query.$or = [
        { name: containsText(s) },
        { email: containsText(s) },
        { phone: containsText(s) },
        { companyName: containsText(s) },
        { gstinOrTaxId: containsText(s) },
      ];
    }

    const { page: pageNum, limit: pageSize, skip } = parsePagination(page, limit);
    const [suppliers, total] = await Promise.all([
      SupplierModel.find(query).sort({ name: 1 }).skip(skip).limit(pageSize),
      SupplierModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: suppliers,
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

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { name, email, phone, companyName, gstinOrTaxId, address } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Supplier name is required' } });
      return;
    }

    const supplier = await SupplierModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      companyName: companyName ? companyName.trim() : undefined,
      gstinOrTaxId: gstinOrTaxId ? gstinOrTaxId.trim() : undefined,
      address: address || {},
      outstandingBalance: 0,
      isActive: true,
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_SUPPLIER',
      entityType: 'Supplier',
      entityId: String(supplier._id),
      details: { name: supplier.name, company: supplier.companyName },
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const supplier = await SupplierModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true }
    );

    if (!supplier) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
      return;
    }

    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const supplier = await SupplierModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
      return;
    }

    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    next(err);
  }
}
