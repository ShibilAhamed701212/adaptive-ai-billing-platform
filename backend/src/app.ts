import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
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
import posRoutes from './modules/pos/pos.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import supplierRoutes from './modules/suppliers/supplier.routes';
import purchaseRoutes from './modules/purchases/purchase.routes';
import returnRoutes from './modules/returns/return.routes';
import shiftRoutes from './modules/shifts/shift.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import systemRoutes from './modules/system/system.routes';
import saasRoutes from './modules/saas/saas.routes';
import agencyRoutes from './modules/agency/agency.routes';

export function createApp(): Express {
  const app = express();

  // Global Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(morgan('dev'));
  app.use(rateLimiter);

  // Serve frontend static build if present (Unified Render Deployment)
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  const hasFrontendDist = fs.existsSync(frontendDistPath);

  if (hasFrontendDist) {
    app.use(express.static(frontendDistPath));
  } else {
    // Root Endpoint when running API-only mode
    app.get('/', (req, res) => {
      res.json({
        message: 'Adaptive AI-Powered Billing API Server is running',
        frontendUrl: 'http://localhost:5173',
        healthCheck: '/api/v1/health',
        version: '1.1.0',
      });
    });
  }

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
        'pos',
        'inventory',
        'suppliers',
        'purchases',
        'returns',
        'shifts',
        'expenses',
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
  app.use('/api/v1/pos', posRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/suppliers', supplierRoutes);
  app.use('/api/v1/purchases', purchaseRoutes);
  app.use('/api/v1/returns', returnRoutes);
  app.use('/api/v1/shifts', shiftRoutes);
  app.use('/api/v1/expenses', expenseRoutes);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api/v1/saas', saasRoutes);
  app.use('/api/v1/agency', agencyRoutes);

  // SPA Client-Side Routing Fallback
  if (hasFrontendDist) {
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  // 404 Handler for API routes (or all unmatched routes if frontend is not present)
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
