import { Request, Response, NextFunction } from 'express';
import { CustomerModel } from '../../models/Customer.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { validateCustomFields } from '../../dynamic-engine/custom-fields/field-validator';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';
import { parsePagination, containsText } from '../../core/utils/query';

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { search, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (search) {
      query.$or = [
        { name: containsText(String(search)) },
        { email: containsText(String(search)) },
        { gstinOrTaxId: containsText(String(search)) },
        { companyName: containsText(String(search)) },
      ];
    }

    const { page: pageNum, limit: pageSize, skip } = parsePagination(page, limit);
    const [customers, total] = await Promise.all([
      CustomerModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      CustomerModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: skip + customers.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const customer = await CustomerModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { name, email, phone, companyName, gstinOrTaxId, billingAddress, shippingAddress, customFields, tags, notes, creditLimit } = req.body;

    if (!name || !email) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and email are required' } });
      return;
    }

    // Dynamic field validation against metadata
    const fieldDefs = await CustomFieldModel.find({ organizationId: orgId, targetEntity: 'customer' }).lean();
    const validation = validateCustomFields(fieldDefs, customFields);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: { code: 'CUSTOM_FIELD_ERROR', message: 'Custom field validation failed', details: validation.errors },
      });
      return;
    }

    const customer = await CustomerModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name,
      email,
      phone,
      companyName,
      gstinOrTaxId,
      billingAddress: billingAddress || {},
      shippingAddress: shippingAddress || {},
      customFields: customFields || {},
      tags: tags || [],
      notes,
      creditLimit: Number(creditLimit) || 0,
      outstandingBalance: 0,
      isActive: true,
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_CUSTOMER',
      entityType: 'Customer',
      entityId: String(customer._id),
      details: { name, email },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { customFields } = req.body;

    if (customFields) {
      const fieldDefs = await CustomFieldModel.find({ organizationId: orgId, targetEntity: 'customer' }).lean();
      const validation = validateCustomFields(fieldDefs, customFields);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: { code: 'CUSTOM_FIELD_ERROR', message: 'Custom field validation failed', details: validation.errors },
        });
        return;
      }
    }

    const customer = await CustomerModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true }
    );

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const customer = await CustomerModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      { isActive: false },
      { new: true }
    );

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json({ success: true, message: 'Customer deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
