import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { TenantContext } from '@billing/shared';
import { OrganizationModel } from '../../models/Organization.model';

// Extend express Request
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing' },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as TenantContext;

    if (!decoded.organizationId || !decoded.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid tenant token payload' },
      });
      return;
    }

    req.tenant = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Authentication failed or token expired', details: err.message },
    });
  }
}

export function requireModule(moduleName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant session' } });
        return;
      }

      const org = await OrganizationModel.findById(req.tenant.organizationId)
        .select('enabledModules')
        .lean();

      if (!org) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
        return;
      }

      const modules = (org.enabledModules || []) as string[];
      if (!modules.includes(moduleName)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'MODULE_DISABLED',
            message: `The '${moduleName}' module is not enabled for this organization`,
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant session' } });
      return;
    }

    if (!allowedRoles.includes(req.tenant.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Role '${req.tenant.role}' not permitted for this action` },
      });
      return;
    }

    next();
  };
}
