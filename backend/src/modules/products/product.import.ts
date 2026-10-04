import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { ProductModel } from '../../models/Product.model';
import { OrganizationModel } from '../../models/Organization.model';

const MAX_ROWS = 5000;
const DEFAULT_TAX_RATE: Record<string, number> = { GST: 0.18, VAT: 0.2 };

/** Read the first non-empty value among column-name variants. */
function pick(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

/** Accept tax as a fraction (0.18) or a percentage (18 / "18%"). */
function parseTaxRate(raw: string): number {
  const n = parseFloat(raw.replace('%', ''));
  return n > 1 ? n / 100 : n;
}

export async function importProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = new mongoose.Types.ObjectId(req.tenant!.organizationId);

    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No CSV file uploaded' } });
      return;
    }

    let records: Record<string, string>[];
    try {
      records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, bom: true, trim: true });
    } catch (parseErr: any) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CSV', message: `Invalid CSV format: ${parseErr.message}` } });
      return;
    }
    if (records.length > MAX_ROWS) {
      res.status(400).json({ success: false, error: { code: 'TOO_MANY_ROWS', message: `A single import is limited to ${MAX_ROWS} rows; split the file and import in parts.` } });
      return;
    }

    const org = await OrganizationModel.findById(orgId).select('settings.taxSystem').lean();
    const defaultTaxRate = DEFAULT_TAX_RATE[(org as any)?.settings?.taxSystem] ?? 0;

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [index, row] of records.entries()) {
      const rowNo = index + 2; // header is row 1
      try {
        const sku = (pick(row, 'sku', 'SKU') || '').toUpperCase();
        const name = pick(row, 'name', 'Name');
        const unitPrice = parseFloat(pick(row, 'unitPrice', 'price', 'Price') ?? '');
        if (!sku || !name || !Number.isFinite(unitPrice) || unitPrice < 0) {
          failed++;
          errors.push(`Row ${rowNo}: needs sku, name and a non-negative unitPrice`);
          continue;
        }

        // Only overwrite columns present in the file, so re-importing a price list never wipes
        // stock levels, costs or tax rates that weren't included. Defaults apply to new products only.
        const set: Record<string, unknown> = { name, unitPrice, isActive: true };
        const description = pick(row, 'description', 'Description');
        const unit = pick(row, 'unit', 'Unit');
        const costPrice = pick(row, 'costPrice', 'cost');
        const tax = pick(row, 'taxRate', 'tax', 'Tax');
        const stock = pick(row, 'stockQuantity', 'stock', 'Stock');
        const barcode = pick(row, 'barcode', 'Barcode');
        if (description !== undefined) set.description = description;
        if (unit !== undefined) set.unit = unit;
        if (costPrice !== undefined) set.costPrice = Math.max(0, parseFloat(costPrice) || 0);
        if (tax !== undefined) {
          const rate = parseTaxRate(tax);
          if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error(`invalid tax rate '${tax}'`);
          set.taxRate = rate;
        }
        if (stock !== undefined) {
          const qty = parseInt(stock, 10);
          if (!Number.isFinite(qty) || qty < 0) throw new Error(`invalid stock quantity '${stock}'`);
          set.stockQuantity = qty;
        }
        if (barcode !== undefined) set.barcode = barcode;

        const setOnInsert: Record<string, unknown> = { manageInventory: true };
        if (set.unit === undefined) setOnInsert.unit = 'unit';
        if (set.taxRate === undefined) setOnInsert.taxRate = defaultTaxRate;
        if (set.stockQuantity === undefined) setOnInsert.stockQuantity = 0;

        await ProductModel.findOneAndUpdate(
          { organizationId: orgId, sku },
          { $set: set, $setOnInsert: setOnInsert },
          { upsert: true, new: true, runValidators: true }
        );
        imported++;
      } catch (e: any) {
        failed++;
        errors.push(`Row ${rowNo}: ${e.message}`);
      }
    }

    res.json({ success: true, data: { total: records.length, imported, failed, errors: errors.slice(0, 10) } });
  } catch (err) {
    next(err);
  }
}
