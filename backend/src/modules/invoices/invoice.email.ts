import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

export async function sendInvoiceEmail(invoice: any, org: any, toEmail: string) {
  // Usually this would come from ENV vars (e.g. SMTP_HOST, SMTP_PORT)
  // We'll throw an error if no user/pass is configured.
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials (SMTP_USER, SMTP_PASS) are not configured in .env');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });

  // Generate PDF buffer
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text(org.name || 'Adaptive Billing Platform', { align: 'left' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Total Due: ${invoice.totals.grandTotal}`);
    doc.end();
  });

  const mailOptions = {
    from: `"${org.name}" <${user}>`,
    to: toEmail,
    subject: `Invoice #${invoice.invoiceNumber} from ${org.name}`,
    text: `Dear ${invoice.customer.name},\n\nPlease find attached your invoice #${invoice.invoiceNumber} for the amount of ${invoice.totals.grandTotal}.\n\nThank you for your business!`,
    attachments: [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  return await transporter.sendMail(mailOptions);
}
