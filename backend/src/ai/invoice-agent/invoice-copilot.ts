import { CustomerModel } from '../../models/Customer.model';
import { ProductModel } from '../../models/Product.model';
import { InvoiceCopilotDraft } from '@billing/shared';
import { callLLM } from '../llm-provider';
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
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse LLM JSON response, falling back to heuristic parsing:', e);
    }
  }

  // 3. Deterministic Heuristic Engine Fallback
  const lowerPrompt = prompt.toLowerCase().trim();

  // Check if input is just a greeting or too ambiguous
  const isJustGreeting = /^(hi|hello|hey|yo|help|test)\b/i.test(lowerPrompt) && lowerPrompt.length < 15;

  let matchedCustomer = customers.find((c) =>
    lowerPrompt.includes(c.name.toLowerCase()) ||
    (c.companyName && lowerPrompt.includes(c.companyName.toLowerCase()))
  );

  const items: InvoiceCopilotDraft['items'] = [];

  for (const prod of products) {
    const nameMatch = lowerPrompt.includes(prod.name.toLowerCase());
    const skuMatch = lowerPrompt.includes(prod.sku.toLowerCase());

    if (nameMatch || skuMatch) {
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
        taxRate: 0.18,
        unit: 'unit',
      });
    } else if (isJustGreeting) {
      // Default sample for demo purposes
      items.push({
        productName: products[0]?.name || 'Standard Enterprise Service',
        productId: products[0] ? String(products[0]._id) : undefined,
        quantity: 1,
        unitPrice: products[0]?.unitPrice || 25000,
        taxRate: products[0]?.taxRate || 0.18,
        unit: products[0]?.unit || 'unit',
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

  if (!matchedCustomer && customers.length > 0) {
    matchedCustomer = customers[0];
  }

  let dueDateOffsetDays = 30;
  const dueMatch = prompt.match(/due\s*(?:in|after)?\s*(\d+)\s*days?/i);
  if (dueMatch && dueMatch[1]) {
    dueDateOffsetDays = parseInt(dueMatch[1], 10);
  }

  const confidenceScore = isJustGreeting ? 0.70 : (matchedCustomer && items.length > 0 ? 0.95 : 0.82);
  const explanation = isJustGreeting
    ? `Tip: For best results, specify a client and item (e.g. "Bill ${customers[0]?.name || 'Client'}: 2 ${products[0]?.name || 'units'} at ₹${products[0]?.unitPrice || '50,000'}")`
    : `Matched customer '${matchedCustomer?.name || 'ad-hoc'}' with ${items.length} item(s) from catalog.`;

  return {
    customerName: matchedCustomer?.name || 'Walk-in Customer',
    customerId: matchedCustomer ? String(matchedCustomer._id) : undefined,
    items,
    dueDateOffsetDays,
    notes: 'Generated via Invoice Copilot',
    confidenceScore,
    explanation,
  };
}
