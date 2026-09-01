import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './product.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { createProductSchema, updateProductSchema } from '../../core/schemas/product.schema';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', validate(createProductSchema), createProduct);
router.patch('/:id', validate(updateProductSchema), updateProduct);
router.delete('/:id', requireRole(['admin', 'manager']), deleteProduct);

export default router;
