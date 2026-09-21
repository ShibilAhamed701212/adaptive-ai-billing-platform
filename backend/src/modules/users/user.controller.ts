import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../../models/User.model';
import { MembershipModel } from '../../models/Membership.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const memberships = await MembershipModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
      .populate({ path: 'userId', select: '-passwordHash' })
      .sort({ createdAt: -1 });
    const users = memberships
      .filter((membership: any) => membership.userId)
      .map((membership: any) => ({
        ...(membership.userId.toObject?.() || membership.userId),
        role: membership.role,
        isActive: membership.status === 'active',
      }));
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { name, email, password, role } = req.body;

    if (!name || !email || !String(email).includes('@')) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A name and valid email address are required' } });
      return;
    }
    const allowedRoles = ['admin', 'manager', 'accountant', 'sales', 'viewer'];
    if (role && !allowedRoles.includes(role)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user role' } });
      return;
    }

    // Email is globally unique across the platform.
    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });

    if (existing) {
      const alreadyMember = await MembershipModel.exists({ userId: existing._id, organizationId: new mongoose.Types.ObjectId(orgId) });
      if (alreadyMember) {
        res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'This user already belongs to the organization' } });
        return;
      }
      await MembershipModel.create({
        userId: existing._id,
        organizationId: new mongoose.Types.ObjectId(orgId),
        role: role || 'viewer',
        status: 'active',
      });
      res.status(201).json({ success: true, data: { _id: existing._id, name: existing.name, email: existing.email, role: role || 'viewer', isActive: true } });
      return;
    }
    if (!password || String(password).length < 8) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'New users need a password of at least 8 characters' } });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await UserModel.create({ organizationId: new mongoose.Types.ObjectId(orgId), name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role: role || 'viewer', isActive: true });

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

    const membership = await MembershipModel.findOne({ userId, organizationId: new mongoose.Types.ObjectId(orgId) });
    const user = membership ? await UserModel.findById(userId) : null;
    if (!user || !membership) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const allowedRoles = ['admin', 'manager', 'accountant', 'sales', 'viewer'];
    if (role && !allowedRoles.includes(role)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user role' } });
      return;
    }
    if (password && String(password).length < 8) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
      return;
    }
    if ((role && role !== 'admin') || isActive === false) {
      const activeAdminCount = await MembershipModel.countDocuments({ organizationId: new mongoose.Types.ObjectId(orgId), role: 'admin', status: 'active' });
      if (membership.role === 'admin' && membership.status === 'active' && activeAdminCount <= 1) {
        res.status(400).json({ success: false, error: { code: 'LAST_ADMIN', message: 'Assign another active administrator before changing or disabling the last administrator' } });
        return;
      }
    }
    if (name) user.name = name.trim();
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Organization role and access are membership-scoped; do not deactivate a user in
    // their other organizations when changing access here.
    if (role) membership.role = role;
    if (isActive !== undefined) membership.status = isActive ? 'active' : 'disabled';
    await membership.save();

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: String(user._id),
      details: { email: user.email, role: membership.role, isActive: membership.status === 'active' },
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: membership.role,
        isActive: membership.status === 'active',
      },
    });
  } catch (err) {
    next(err);
  }
}
