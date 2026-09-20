import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { HeldBillModel } from '../../models/HeldBill.model';

export async function listHeldBills(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const bills = await HeldBillModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).sort({ heldAt: -1 });

    res.json({ success: true, data: bills });
  } catch (err) {
    next(err);
  }
}

export async function holdBill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { customerId, customerName, items, holdReference, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: { code: 'EMPTY_CART', message: 'Cannot hold an empty cart' } });
      return;
    }

    const ref = holdReference || `Parked #${Date.now().toString().slice(-4)}`;

    const held = await HeldBillModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      cashierId: new mongoose.Types.ObjectId(userId),
      customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
      customerName: customerName || 'Walk-in Customer',
      holdReference: ref,
      items,
      notes,
      heldAt: new Date(),
    });

    res.status(201).json({ success: true, data: held });
  } catch (err) {
    next(err);
  }
}

export async function restoreHeldBill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const bill = await HeldBillModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!bill) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Held bill not found' } });
      return;
    }

    res.json({ success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

export async function deleteHeldBill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const bill = await HeldBillModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!bill) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Held bill not found' } });
      return;
    }

    res.json({ success: true, message: 'Held bill cancelled' });
  } catch (err) {
    next(err);
  }
}
