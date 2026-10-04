import { CustomerModel } from '../../models/Customer.model';
import { ProductModel } from '../../models/Product.model';
import { InvoiceCopilotDraft } from '@billing/shared';
import { callLLM } from '../llm-provider';
import mongoose from 'mongoose';
import { OrganizationModel } from '../../models/Organization.model';
import { escapeRegex } from '../../core/utils/query';

/** Keep the grounding context (and the AI bill) bounded for large catalogs. */
const MAX_GROUNDING_RECORDS = 200;
const DEFAULT_TAX_RATE: Record<string, number> = { GST: 0.18, VAT: 0.2 };

export async function parseInvoicePromptWithTools(
  organizationId: string,
  prompt: string
): Promise<InvoiceCopilotDraft> {
  const orgObjId = new mongoose.Types.ObjectId(organizationId);

  // 1. Fetch available customers & products for tool grounding
  const [customers, products, org] = await Promise.all([
    CustomerModel.find({ organizationId: orgObjId, isActive: true })
      .select('_id name companyName gstinOrTaxId')
      .sort({ updatedAt: -1 })
      .limit(MAX_GROUNDING_RECORDS)
      .lean(),
    ProductModel.find({ organizationId: orgObjId, isActive: true })
      .select('_id name sku unitPrice taxRate unit')
      .sort({ updatedAt: -1 })
      .limit(MAX_GROUNDING_RECORDS)
      .lean(),
    OrganizationModel.findById(orgObjId).select('settings.taxSystem').lean(),
  ]);
  const defaultTaxRate = DEFAULT_TAX_RATE[(org as any)?.settings?.taxSystem] ?? 0;
  const customerIds = new Set(customers.map((c) => String(c._id)));
  const productIds = new Set(products.map((p) => String(p._id)));

  // 2. Attempt LLM with Grounded Tools
  const systemPrompt = `You are an AI Invoice Parsing Agent for an Adaptive Billing Platform.
Your task is to parse the user's natural language invoice request into a structured JSON draft.
Ground your response using the available tenant database:
CUSTOMERS: ${JSON.stringify(customers.map((c) => ({ id: c._id, name: c.name, company: c.companyName })))}
PRODUCTS: ${JSON.stringify(products.map((p) => ({ id: p._id, name: p.name, sku: p.sku, unitPrice: p.unitPrice, taxRate: p.taxRate, unit: p.unit })))}

Respond ONLY with a JSON object matching this schema:
{
  "customerName": string,
  "customerId": string (optional matching id from available customers),
  "items": [
    {
      "productName": string,
      "productId": string (optional matching id),
      "quantity": number,
      "unitPrice": number,
      "taxRate": number (e.g. 0.18),
      "unit": string
    }
  ],
  "dueDateOffsetDays": number,
  "notes": string,
  "confidenceScore": number,
  "explanation": string
}`;

  const llmResult = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    { json: true }
  );

  if (llmResult) {
    try {
      const parsed = JSON.parse(llmResult);
      if (parsed && parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        // Never trust model output blindly: drop ids that aren't this tenant's and sanitise numbers.
        const items = parsed.items
          .map((i: any) => ({
            productName: String(i.productName || '').slice(0, 200),
            productId: i.productId && productIds.has(String(i.productId)) ? String(i.productId) : undefined,
            quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
            unitPrice: Number(i.unitPrice) >= 0 ? Number(i.unitPrice) : 0,
            taxRate: Number(i.taxRate) >= 0 && Number(i.taxRate) <= 1 ? Number(i.taxRate) : defaultTaxRate,
            unit: String(i.unit || 'unit').slice(0, 30),
          }))
          .filter((i: any) => i.productName);
        if (items.length > 0) {
          return {
            ...parsed,
            customerId: parsed.customerId && customerIds.has(String(parsed.customerId)) ? String(parsed.customerId) : undefined,
            items,
            dueDateOffsetDays: Number(parsed.dueDateOffsetDays) >= 0 ? Math.min(365, Number(parsed.dueDateOffsetDays)) : 30,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse LLM JSON response, falling back to heuristic parsing:', e);
    }
  }

  // 3. Deterministic Heuristic Engine Fallback
  const lowerPrompt = prompt.toLowerCase().trim();


  let matchedCustomer = customers.find((c) =>
    lowerPrompt.includes(c.name.toLowerCase()) ||
    (c.companyName && lowerPrompt.includes(c.companyName.toLowerCase()))
  );

  const items: InvoiceCopilotDraft['items'] = [];

  for (const prod of products) {
    const nameMatch = lowerPrompt.includes(prod.name.toLowerCase());
    const skuMatch = Boolean(prod.sku) && lowerPrompt.includes(prod.sku.toLowerCase());

    if (nameMatch || skuMatch) {
      let qty = 1;
      const safeName = escapeRegex(prod.name.toLowerCase());
      const qtyRegex = new RegExp(`(\\d+)\\s*(?:units?|pcs?|x|nos?)?\\s*${safeName}`, 'i');
      const match1 = prompt.match(qtyRegex);
      if (match1 && match1[1]) {
        qty = parseInt(match1[1], 10);
      } else {
        const qtyRegexAfter = new RegExp(`${safeName}\\s*(?:x|times|qty|quantity)?\\s*(\\d+)`, 'i');
        const match2 = prompt.match(qtyRegexAfter);
        if (match2 && match2[1]) {
          qty = parseInt(match2[1], 10);
        }
      }

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

  if (items.length === 0) {
    const genericNumber = prompt.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(?:at|@|for|\$|₹)\s*(\d+)/i);
    if (genericNumber) {
      items.push({
        productName: genericNumber[2].trim(),
        quantity: parseInt(genericNumber[1], 10),
        unitPrice: parseFloat(genericNumber[3]),
        taxRate: defaultTaxRate,
        unit: 'unit',
      });
    }
    // Otherwise leave items empty: inventing a line (or a customer) would put made-up charges on
    // a real invoice if the user applies the draft without reading it.
  }

  let dueDateOffsetDays = 30;
  const dueMatch = prompt.match(/due\s*(?:in|after)?\s*(\d+)\s*days?/i);
  if (dueMatch && dueMatch[1]) {
    dueDateOffsetDays = parseInt(dueMatch[1], 10);
  }

  const confidenceScore = items.length === 0 ? 0 : matchedCustomer ? 0.9 : 0.6;
  const explanation = items.length === 0
    ? `I couldn't identify any items. Name a client and an item, e.g. "Bill ${customers[0]?.name || 'Client'}: 2 ${products[0]?.name || 'units'} at ${products[0]?.unitPrice || 500}".`
    : `Matched ${matchedCustomer ? `customer '${matchedCustomer.name}'` : 'no customer (choose one before issuing)'} with ${items.length} item(s).`;

  return {
    customerName: matchedCustomer?.name || '',
    customerId: matchedCustomer ? String(matchedCustomer._id) : undefined,
    items,
    dueDateOffsetDays,
    notes: 'Generated via Invoice Copilot',
    confidenceScore,
    explanation,
  };
}
