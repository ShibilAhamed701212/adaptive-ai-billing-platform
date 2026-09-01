import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditLogModel } from '../../core/audit/audit.service';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { action, entityType, userId, search, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (userId) query.userId = new mongoose.Types.ObjectId(String(userId));
    if (search) {
      query.$or = [
        { userEmail: { $regex: String(search), $options: 'i' } },
        { action: { $regex: String(search), $options: 'i' } },
        { entityType: { $regex: String(search), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLogModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
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
