import { Request, Response, NextFunction } from 'express';
import { ProjectModel } from '../../models/Project.model';
import { TimesheetModel } from '../../models/Timesheet.model';
import { RetainerModel } from '../../models/Retainer.model';
import { CustomerModel } from '../../models/Customer.model';
import mongoose from 'mongoose';

// PROJECTS
export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const projects = await ProjectModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
      .populate('clientId', 'name email')
      .lean();
    res.json({ success: true, data: projects });
  } catch (err) { next(err); }
}

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { clientId, name, description, status, hourlyRate, budget } = req.body;

    const client = await CustomerModel.findOne({ _id: new mongoose.Types.ObjectId(clientId), organizationId: new mongoose.Types.ObjectId(orgId) });
    if (!client) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }

    const project = await ProjectModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      clientId: client._id,
      name, description, status, hourlyRate, budget
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await ProjectModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!project) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }); return; }
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await ProjectModel.findOneAndDelete({ _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) });
    if (!project) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }); return; }
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
}

// TIMESHEETS
export async function listTimesheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ts = await TimesheetModel.find({ organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) })
      .populate('projectId', 'name')
      .populate('userId', 'name')
      .lean();
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function createTimesheet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { projectId, date, hours, description, isBillable } = req.body;

    if (hours <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Hours must be greater than 0' } });
      return;
    }

    const project = await ProjectModel.findOne({ _id: new mongoose.Types.ObjectId(projectId), organizationId: new mongoose.Types.ObjectId(orgId) });
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const ts = await TimesheetModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(req.tenant!.userId),
      date: date || new Date(),
      hours, description, isBillable
    });

    res.status(201).json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function updateTimesheet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ts = await TimesheetModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!ts) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Timesheet not found' } }); return; }
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}

export async function deleteTimesheet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ts = await TimesheetModel.findOneAndDelete({ _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) });
    if (!ts) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Timesheet not found' } }); return; }
    res.json({ success: true, data: ts });
  } catch (err) { next(err); }
}

// RETAINERS
export async function listRetainers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const retainers = await RetainerModel.find({ organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) })
      .populate('clientId', 'name email')
      .lean();
    res.json({ success: true, data: retainers });
  } catch (err) { next(err); }
}

export async function createRetainer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { clientId, amount, billingPeriod, status } = req.body;

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Retainer amount must be greater than zero' } });
      return;
    }

    const client = await CustomerModel.findOne({ _id: new mongoose.Types.ObjectId(clientId), organizationId: new mongoose.Types.ObjectId(orgId) });
    if (!client) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }

    const retainer = await RetainerModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      clientId: client._id,
      amount: Number(amount),
      remainingBalance: Number(amount),
      billingPeriod: ['monthly', 'quarterly', 'annual'].includes(billingPeriod) ? billingPeriod : 'monthly',
      status: ['active', 'exhausted', 'cancelled'].includes(status) ? status : 'active',
    });

    res.status(201).json({ success: true, data: retainer });
  } catch (err) { next(err); }
}

export async function updateRetainer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const retainer = await RetainerModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!retainer) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Retainer not found' } }); return; }
    res.json({ success: true, data: retainer });
  } catch (err) { next(err); }
}

export async function deleteRetainer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const retainer = await RetainerModel.findOneAndDelete({ _id: new mongoose.Types.ObjectId(req.params.id), organizationId: new mongoose.Types.ObjectId(req.tenant!.organizationId) });
    if (!retainer) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Retainer not found' } }); return; }
    res.json({ success: true, data: retainer });
  } catch (err) { next(err); }
}
