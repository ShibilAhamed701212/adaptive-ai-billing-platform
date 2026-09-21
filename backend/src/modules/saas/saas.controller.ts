import { Request, Response, NextFunction } from 'express';
import { PlanModel } from '../../models/Plan.model';
import { SubscriptionModel } from '../../models/Subscription.model';
import { CustomerModel } from '../../models/Customer.model';
import mongoose from 'mongoose';

export async function listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const plans = await PlanModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) }).lean();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { name, code, description, price, currency, billingInterval, features, isPublic } = req.body;

    if (!name || !Number.isFinite(Number(price)) || Number(price) < 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plan name and a non-negative price are required' } });
      return;
    }
    const plan = await PlanModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name: String(name).trim(),
      price: Number(price),
      billingInterval: billingInterval === 'yearly' ? 'yearly' : 'monthly',
      features: Array.isArray(features) ? features.filter((feature) => typeof feature === 'string').map((feature) => feature.trim()).filter(Boolean) : [],
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const planId = req.params.id;

    const plan = await PlanModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(planId), organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true, runValidators: true }
    );

    if (!plan) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const planId = req.params.id;

    // Check if in use
    const activeSubs = await SubscriptionModel.countDocuments({ 
      organizationId: new mongoose.Types.ObjectId(orgId), 
      planId: new mongoose.Types.ObjectId(planId) 
    });

    if (activeSubs > 0) {
      res.status(400).json({ success: false, error: { code: 'IN_USE', message: 'Plan is used by active subscriptions' } });
      return;
    }

    const plan = await PlanModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(planId), 
      organizationId: new mongoose.Types.ObjectId(orgId)
    });

    if (!plan) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

export async function listSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const subs = await SubscriptionModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
      .populate('customerId', 'name email')
      .populate('planId', 'name price billingInterval')
      .lean();
    res.json({ success: true, data: subs });
  } catch (err) {
    next(err);
  }
}

export async function createSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { customerId, planId, status, startDate, renewalDate, cancelDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(planId)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid customer and plan are required' } });
      return;
    }
    const [customer, plan] = await Promise.all([
      CustomerModel.findOne({ _id: new mongoose.Types.ObjectId(customerId), organizationId: new mongoose.Types.ObjectId(orgId) }),
      PlanModel.findOne({ _id: new mongoose.Types.ObjectId(planId), organizationId: new mongoose.Types.ObjectId(orgId) })
    ]);

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found in this organization' } });
      return;
    }

    if (!plan) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found in this organization' } });
      return;
    }

    const validStates = ['trialing', 'active', 'past_due', 'canceled', 'unpaid'];
    const validStatus = validStates.includes(status) ? status : 'active';
    const start = startDate ? new Date(startDate) : new Date();
    const renewal = renewalDate ? new Date(renewalDate) : new Date(start);
    if (Number.isNaN(start.getTime()) || Number.isNaN(renewal.getTime())) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid subscription date' } });
      return;
    }
    if (!renewalDate) renewal.setFullYear(renewal.getFullYear() + (plan.billingInterval === 'yearly' ? 1 : 0), renewal.getMonth() + (plan.billingInterval === 'monthly' ? 1 : 0));

    const sub = await SubscriptionModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      customerId: customer._id,
      planId: plan._id,
      status: validStatus,
      startDate: start,
      renewalDate: renewal,
      cancelDate: cancelDate
    });

    res.status(201).json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
}

export async function updateSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const subId = req.params.id;
    const { status, renewalDate, cancelDate } = req.body;

    const sub = await SubscriptionModel.findOne({
      _id: new mongoose.Types.ObjectId(subId),
      organizationId: new mongoose.Types.ObjectId(orgId)
    });

    if (!sub) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    // State machine transitions
    if (status) {
      const allowedTransitions: any = {
        trialing: ['active', 'canceled'],
        active: ['past_due', 'canceled'],
        past_due: ['active', 'canceled'],
        canceled: [],
        unpaid: []
      };

      const currentStatus = sub.status || 'active';
      if (status !== currentStatus) {
        if (!allowedTransitions[currentStatus]?.includes(status)) {
          res.status(400).json({ 
            success: false, 
            error: { code: 'INVALID_TRANSITION', message: `Cannot transition subscription from ${currentStatus} to ${status}` } 
          });
          return;
        }
        sub.status = status;
      }
    }

    if (renewalDate) sub.renewalDate = renewalDate;
    if (cancelDate) sub.cancelDate = cancelDate;

    await sub.save();
    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const subId = req.params.id;

    const sub = await SubscriptionModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(subId),
      organizationId: new mongoose.Types.ObjectId(orgId)
    });

    if (!sub) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
}
