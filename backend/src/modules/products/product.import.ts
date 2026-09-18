import { Request, Response, NextFunction } from 'express';
import { ProductModel } from '../../models/Product.model';
import { parse } from 'csv-parse';
import mongoose from 'mongoose';

export async function importProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;

    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No CSV file uploaded' } });
      return;
    }

    const csvData = req.file.buffer.toString('utf-8');
    
    parse(csvData, { columns: true, skip_empty_lines: true }, async (err: any, records: any[]) => {
      if (err) {
        res.status(400).json({ success: false, error: { message: 'Invalid CSV format', details: err.message } });
        return;
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const [index, row] of records.entries()) {
        try {
          const sku = (row.sku || row.SKU || '').toUpperCase().trim();
          const name = row.name || row.Name || '';
          const unitPrice = parseFloat(row.unitPrice || row.price || row.Price || 0);
          
          if (!sku || !name || isNaN(unitPrice)) {
            failed++;
            errors.push(`Row ${index + 1}: Missing required fields (sku, name, unitPrice)`);
            continue;
          }

          const stockQuantity = parseInt(row.stockQuantity || row.stock || 0, 10);
          const barcode = row.barcode || row.Barcode || '';

          await ProductModel.findOneAndUpdate(
            { organizationId: new mongoose.Types.ObjectId(orgId), sku },
            {
              name,
              description: row.description || row.Description || '',
              unit: row.unit || row.Unit || 'unit',
              unitPrice,
              costPrice: parseFloat(row.costPrice || 0) || 0,
              taxRate: parseFloat(row.taxRate || row.tax || 0.18),
              stockQuantity,
              barcode,
              manageInventory: true,
              isActive: true,
            },
            { upsert: true, new: true }
          );

          imported++;
        } catch (e: any) {
          failed++;
          errors.push(`Row ${index + 1}: ${e.message}`);
        }
      }

      res.json({
        success: true,
        data: {
          total: records.length,
          imported,
          failed,
          errors: errors.slice(0, 10) // Return top 10 errors
        }
      });
    });
  } catch (err) {
    next(err);
  }
}
