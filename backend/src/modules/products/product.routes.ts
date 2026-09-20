import { Router } from 'express';
import {
  listProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
} from './product.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { createProductSchema, updateProductSchema } from '../../core/schemas/product.schema';

import multer from 'multer';
import { importProducts } from './product.import';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(tenantMiddleware);

router.get('/', listProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProduct);
router.post('/', validate(createProductSchema), createProduct);
router.patch('/:id', validate(updateProductSchema), updateProduct);
router.post('/import', upload.single('file'), importProducts);

router.delete('/:id', requireRole(['admin', 'manager']), deleteProduct);

export default router;
