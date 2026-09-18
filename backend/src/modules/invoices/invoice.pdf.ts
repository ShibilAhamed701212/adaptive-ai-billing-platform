import PDFDocument from 'pdfkit';
import { Response } from 'express';

export function generateInvoicePdf(invoice: any, org: any, res: Response) {
  return new Promise<void>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      // Pipe its output to the response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
      doc.pipe(res);

      // --- Header ---
      doc.fontSize(20).text(org.name || 'Adaptive Billing Platform', { align: 'left' });
      doc.fontSize(10).text('TAX INVOICE', { align: 'right' });
      doc.moveDown();

      doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.fontSize(10).text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
      if (org.customFields?.gstin) {
        doc.text(`GSTIN: ${org.customFields.gstin}`);
      }
      doc.moveDown();

      // --- Customer ---
      doc.fontSize(12).text('Billed To:');
      doc.fontSize(10).text(invoice.customer.name);
      if (invoice.customer.email) doc.text(invoice.customer.email);
      doc.moveDown(2);

      // --- Items Table ---
      let y = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Description', 50, y);
      doc.text('Qty', 300, y, { width: 50, align: 'right' });
      doc.text('Price', 350, y, { width: 70, align: 'right' });
      doc.text('Total', 420, y, { width: 80, align: 'right' });
      
      doc.moveTo(50, y + 15).lineTo(500, y + 15).stroke();
      doc.font('Helvetica');
      y += 25;

      invoice.items.forEach((item: any) => {
        doc.text(item.description, 50, y);
        doc.text(item.quantity.toString(), 300, y, { width: 50, align: 'right' });
        doc.text(item.unitPrice.toFixed(2), 350, y, { width: 70, align: 'right' });
        doc.text(item.lineTotal.toFixed(2), 420, y, { width: 80, align: 'right' });
        y += 20;
      });

      doc.moveTo(50, y + 5).lineTo(500, y + 5).stroke();
      y += 15;

      // --- Totals ---
      doc.font('Helvetica-Bold');
      doc.text('Subtotal:', 300, y, { width: 120, align: 'right' });
      doc.text(invoice.totals.subtotal.toFixed(2), 420, y, { width: 80, align: 'right' });
      y += 20;

      doc.text('Tax:', 300, y, { width: 120, align: 'right' });
      doc.text(invoice.totals.taxTotal.toFixed(2), 420, y, { width: 80, align: 'right' });
      y += 20;

      if (invoice.totals.discountTotal > 0) {
        doc.text('Discount:', 300, y, { width: 120, align: 'right' });
        doc.text(`-${invoice.totals.discountTotal.toFixed(2)}`, 420, y, { width: 80, align: 'right' });
        y += 20;
      }

      doc.fontSize(14).text('Total (INR):', 300, y, { width: 120, align: 'right' });
      doc.text(invoice.totals.grandTotal.toFixed(2), 420, y, { width: 80, align: 'right' });

      // --- Notes ---
      if (invoice.notes) {
        doc.moveDown(4);
        doc.fontSize(10).font('Helvetica-Oblique').text(`Notes: ${invoice.notes}`);
      }

      doc.end();
      
      // Wait for stream to finish
      res.on('finish', () => resolve());
      res.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}
