import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditLogModel } from '../../core/audit/audit.service';
import { parsePagination, containsText } from '../../core/utils/query';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { action, entityType, userId, search, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };

    if (action) query.action = String(action);
    if (entityType) query.entityType = String(entityType);
    if (userId) query.userId = new mongoose.Types.ObjectId(String(userId));
    if (search) {
      query.$or = [
        { userEmail: containsText(String(search)) },
        { action: containsText(String(search)) },
        { entityType: containsText(String(search)) },
      ];
    }

    const { page: pageNum, limit: pageSize, skip } = parsePagination(page, limit);
    const [logs, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      AuditLogModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
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
