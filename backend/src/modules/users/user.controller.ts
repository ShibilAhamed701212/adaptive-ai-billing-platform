import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../../models/User.model';
import { MembershipModel } from '../../models/Membership.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const users = await UserModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
      .select('-passwordHash')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required' } });
      return;
    }

    // Email is globally unique across the platform.
    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'An account with this email already exists' },
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'viewer',
      isActive: true,
    });

    // A membership is the source of truth for organization access + role.
    await MembershipModel.create({
      userId: user._id,
      organizationId: new mongoose.Types.ObjectId(orgId),
      role: role || 'viewer',
      status: 'active',
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'INVITE_USER',
      entityType: 'User',
      entityId: String(user._id),
      details: { email: user.email, role: user.role },
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: (user as any).createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.params.id;
    const { name, role, isActive, password } = req.body;

    const user = await UserModel.findOne({
      _id: userId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (name) user.name = name.trim();
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Keep the organization membership role in sync with the user record.
    await MembershipModel.updateOne(
      { userId: user._id, organizationId: new mongoose.Types.ObjectId(orgId) },
      {
        ...(role ? { role } : {}),
        ...(isActive !== undefined ? { status: isActive ? 'active' : 'disabled' } : {}),
        userId: user._id,
        organizationId: new mongoose.Types.ObjectId(orgId),
      },
      { upsert: true }
    );

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: String(user._id),
      details: { email: user.email, role: user.role, isActive: user.isActive },
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
}
