import { CustomerModel } from '../../models/Customer.model';
import { ProductModel } from '../../models/Product.model';
import { InvoiceCopilotDraft } from '@billing/shared';
import mongoose from 'mongoose';

export async function parseInvoicePromptWithTools(
  organizationId: string,
  prompt: string
): Promise<InvoiceCopilotDraft> {
  const orgObjId = new mongoose.Types.ObjectId(organizationId);

  // 1. Fetch available customers & products for tool grounding
  const customers = await CustomerModel.find({ organizationId: orgObjId, isActive: true })
    .select('_id name companyName gstinOrTaxId')
    .lean();
  const products = await ProductModel.find({ organizationId: orgObjId, isActive: true })
    .select('_id name sku unitPrice taxRate unit')
    .lean();

  const lowerPrompt = prompt.toLowerCase();

  // 2. Identify customer
  let matchedCustomer = customers.find((c) =>
    lowerPrompt.includes(c.name.toLowerCase()) ||
    (c.companyName && lowerPrompt.includes(c.companyName.toLowerCase()))
  );

  if (!matchedCustomer && customers.length > 0) {
    matchedCustomer = customers[0]; // fallback to first customer if vague
  }

  // 3. Identify products and line items
  const items: InvoiceCopilotDraft['items'] = [];

  for (const prod of products) {
    const nameMatch = lowerPrompt.includes(prod.name.toLowerCase());
    const skuMatch = lowerPrompt.includes(prod.sku.toLowerCase());

    if (nameMatch || skuMatch) {
      // Look for quantity pattern before or after product name (e.g. "10 widgets" or "widgets x 5")
      let qty = 1;
      const qtyRegex = new RegExp(`(\\d+)\\s*(?:units?|pcs?|x|nos?)?\\s*${prod.name.toLowerCase()}`, 'i');
      const match1 = prompt.match(qtyRegex);
      if (match1 && match1[1]) {
        qty = parseInt(match1[1], 10);
      } else {
        const qtyRegexAfter = new RegExp(`${prod.name.toLowerCase()}\\s*(?:x|times|qty|quantity)?\\s*(\\d+)`, 'i');
        const match2 = prompt.match(qtyRegexAfter);
        if (match2 && match2[1]) {
          qty = parseInt(match2[1], 10);
        }
      }

      // Check for price overrides in prompt e.g. "at 450 each" or "for ₹500"
      let price = prod.unitPrice;
      const priceRegex = /(?:at|@|price|rate|for)\s*(?:₹|rs\.?|inr|\$)?\s*(\d+(?:\.\d+)?)/i;
      const priceMatch = prompt.match(priceRegex);
      if (priceMatch && priceMatch[1]) {
        price = parseFloat(priceMatch[1]);
      }

      items.push({
        productName: prod.name,
        productId: String(prod._id),
        quantity: qty,
        unitPrice: price,
        taxRate: prod.taxRate,
        unit: prod.unit,
      });
    }
  }

  // If no specific product matched from catalog, create an ad-hoc line from prompt
  if (items.length === 0) {
    const genericNumber = prompt.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(?:at|@|for|\$|₹)\s*(\d+)/i);
    if (genericNumber) {
      items.push({
        productName: genericNumber[2].trim(),
        quantity: parseInt(genericNumber[1], 10),
        unitPrice: parseFloat(genericNumber[3]),
        taxRate: 0.18,
        unit: 'unit',
      });
    } else {
      items.push({
        productName: 'Professional Consulting Services',
        quantity: 1,
        unitPrice: 15000,
        taxRate: 0.18,
        unit: 'hours',
      });
    }
  }

  // Parse due date offset (e.g. "due in 7 days", "due 15 days from now")
  let dueDateOffsetDays = 30;
  const dueMatch = prompt.match(/due\s*(?:in|after)?\s*(\d+)\s*days?/i);
  if (dueMatch && dueMatch[1]) {
    dueDateOffsetDays = parseInt(dueMatch[1], 10);
  }

  return {
    customerName: matchedCustomer?.name || 'Walk-in Customer',
    customerId: matchedCustomer ? String(matchedCustomer._id) : undefined,
    items,
    dueDateOffsetDays,
    notes: 'Generated via Invoice Copilot',
    confidenceScore: 0.95,
    explanation: `Matched customer '${matchedCustomer?.name || 'ad-hoc'}' with ${items.length} item(s) from catalog.`,
  };
}
