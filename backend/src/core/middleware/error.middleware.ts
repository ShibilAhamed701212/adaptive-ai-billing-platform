import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { IS_PRODUCTION } from '../../config/env';

/**
 * Global error handler — catches all unhandled errors from route handlers.
 * Provides structured error responses for:
 *  - Zod validation errors (400)
 *  - Mongoose validation errors (400)
 *  - Mongoose CastError / bad ObjectId (400)
 *  - Duplicate key errors (409)
 *  - Custom application errors (statusCode)
 *  - Unknown errors (500)
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log with tenant context if available
  const tenantId = (req as any).tenant?.organizationId || 'unauthenticated';
  console.error(`[Error] [Tenant: ${tenantId}] ${req.method} ${req.url}:`, err.message || err);

  // 1. Zod schema validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Schema validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 2. Mongoose validation error (schema-level)
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e: any) => ({
      path: e.path,
      message: e.message,
      kind: e.kind,
    }));
    res.status(400).json({
      success: false,
      error: {
        code: 'MONGOOSE_VALIDATION_ERROR',
        message: 'Database validation failed',
        details,
      },
    });
    return;
  }

  // 3. Mongoose CastError (invalid ObjectId, etc.)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid value for '${err.path}': '${err.value}'. Expected a valid ${err.kind}.`,
      },
    });
    return;
  }

  // 3b. Malformed id passed to new ObjectId(...) by a handler
  if (err?.name === 'BSONError') {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid identifier format' } });
    return;
  }

  // 4. MongoDB duplicate key error (E11000)
  if (err.code === 11000 || err.code === 11001) {
    const keyPattern = err.keyPattern ? Object.keys(err.keyPattern).join(', ') : 'unknown';
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: `A record with this ${keyPattern} already exists.`,
        details: err.keyValue,
      },
    });
    return;
  }

  // 5. Database Not Connected / Mongoose disconnected error
  if (
    err.name === 'DisconnectedError' ||
    err.name === 'MongooseServerSelectionError' ||
    (err.name === 'MongooseError' && (
      err.message.includes('initial connection is complete') ||
      err.message.includes('buffering timed out') ||
      err.message.includes('Client must be connected') ||
      err.message.includes('topology was closed')
    ))
  ) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_NOT_CONNECTED',
        message: IS_PRODUCTION
          ? 'The service is temporarily unavailable. Please try again shortly.'
          : 'MongoDB is currently not running or unreachable. Please start MongoDB locally, run Docker (docker compose up -d), or provide a free MongoDB Atlas connection string in .env (MONGODB_URI).',
      },
    });
    return;
  }

  // Upload rejected by multer (size/field limits)
  if (err?.name === 'MulterError') {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({ success: false, error: { code: err.code, message: tooLarge ? 'File is too large' : err.message } });
    return;
  }

  // 6. Business-rule errors: handlers throw plain `new Error('Insufficient stock ...')` with a
  // message meant for the user, so answer 400 with it.
  if (!err.statusCode && err instanceof Error && err.name === 'Error') {
    res.status(400).json({ success: false, error: { code: 'REQUEST_FAILED', message: err.message } });
    return;
  }

  // 7. Explicit statusCode, or an unexpected failure (driver/runtime errors). Never expose
  // internal details of unexpected errors to production users; they are logged above.
  const statusCode = err.statusCode || 500;
  const exposeMessage = statusCode < 500 || !IS_PRODUCTION;
  res.status(statusCode).json({
    success: false,
    error: {
      code: typeof err.code === 'string' ? err.code : 'SERVER_ERROR',
      message: exposeMessage ? err.message || 'Internal Server Error' : 'Something went wrong. Please try again.',
    },
  });
}
