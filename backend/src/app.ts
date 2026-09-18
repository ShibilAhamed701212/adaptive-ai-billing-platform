import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './core/middleware/error.middleware';
import { rateLimiter } from './core/middleware/rate-limiter.middleware';

import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/organizations/organization.routes';
import customerRoutes from './modules/customers/customer.routes';
import productRoutes from './modules/products/product.routes';
import invoiceRoutes from './modules/invoices/invoice.routes';
import paymentRoutes from './modules/payments/payment.routes';
import creditNoteRoutes from './modules/credit-notes/credit-note.routes';
import recurringRoutes from './modules/recurring/recurring.routes';
import templateRoutes from './modules/templates/template.routes';
import approvalRoutes from './modules/approvals/approval.routes';
import userRoutes from './modules/users/user.routes';
import auditRoutes from './modules/audit/audit.routes';
import dynamicRoutes from './modules/dynamic/dynamic.routes';
import aiRoutes from './modules/ai/ai.routes';
import reportRoutes from './modules/reports/report.routes';

export function createApp(): Express {
  const app = express();

  // Global Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(morgan('dev'));
  app.use(rateLimiter);

  // Root Endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Adaptive AI-Powered Billing API Server is running',
      frontendUrl: 'http://localhost:5173',
      healthCheck: '/api/v1/health',
      version: '1.1.0',
    });
  });

  // Health Check
  app.get('/api/v1/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Adaptive AI-Powered Billing API',
      timestamp: new Date().toISOString(),
      version: '1.1.0',
      activeModules: [
        'auth',
        'organizations',
        'customers',
        'products',
        'invoices',
        'payments',
        'credit-notes',
        'recurring',
        'invoice-templates',
        'approvals',
        'users',
        'audit-logs',
        'dynamic',
        'ai',
        'reports',
      ],
    });
  });

  // Module Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/organizations', orgRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/credit-notes', creditNoteRoutes);
  app.use('/api/v1/recurring', recurringRoutes);
  app.use('/api/v1/invoice-templates', templateRoutes);
  app.use('/api/v1/approvals', approvalRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/dynamic', dynamicRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/reports', reportRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` },
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
