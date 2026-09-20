import { Request, Response, NextFunction } from 'express';
import { InvoiceModel } from '../../models/Invoice.model';
import { PaymentModel } from '../../models/Payment.model';
import { CustomerModel } from '../../models/Customer.model';
import { ProductModel } from '../../models/Product.model';
import { ReturnModel } from '../../models/Return.model';
import { ExpenseModel } from '../../models/Expense.model';
import { DashboardSummary, AnomalyAlert } from '@billing/shared';
import mongoose from 'mongoose';

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const orgObjId = new mongoose.Types.ObjectId(orgId);

    const [invoices, payments, customers] = await Promise.all([
      InvoiceModel.find({ organizationId: orgObjId }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ organizationId: orgObjId }).lean(),
      CustomerModel.find({ organizationId: orgObjId, isActive: true }).lean(),
    ]);

    const totalRevenue = invoices.reduce((acc, i) => acc + (i.grandTotal || 0), 0);
    const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalOutstanding = invoices.reduce((acc, i) => acc + (i.amountDue || 0), 0);
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue' || (i.amountDue > 0 && new Date(i.dueDate) < new Date()));
    const overdueAmount = overdueInvoices.reduce((acc, i) => acc + i.amountDue, 0);

    const paidCount = invoices.filter((i) => i.status === 'paid').length;
    const pendingCount = invoices.filter((i) => ['draft', 'sent', 'partially_paid', 'pending_approval'].includes(i.status)).length;

    // Detect anomalies
    const anomalies: AnomalyAlert[] = [];
    invoices.forEach((inv) => {
      if (inv.discountTotal && inv.subtotal > 0 && inv.discountTotal / inv.subtotal > 0.2) {
        anomalies.push({
          id: `anomaly_${inv._id}_discount`,
          severity: 'medium',
          type: 'unusual_discount',
          title: `High Discount on #${inv.invoiceNumber}`,
          description: `Discount of ₹${inv.discountTotal.toLocaleString()} (${Math.round((inv.discountTotal / inv.subtotal) * 100)}%) is above normal thresholds.`,
          suggestedAction: 'Review discount approval log',
          relatedEntityId: String(inv._id),
          relatedEntityType: 'invoice',
          timestamp: inv.createdAt,
        });
      }

      if (inv.aiRiskScore === 'HIGH') {
        anomalies.push({
          id: `anomaly_${inv._id}_risk`,
          severity: 'high',
          type: 'late_risk',
          title: `Late Payment Risk: ${inv.customerSnapshot?.name}`,
          description: inv.aiRiskExplanation || 'Payment predicted to be significantly delayed.',
          suggestedAction: 'Send automated polite reminder',
          relatedEntityId: String(inv._id),
          relatedEntityType: 'invoice',
          timestamp: inv.createdAt,
        });
      }
    });

    // Cashflow projection for upcoming 4 weeks
    const today = new Date();
    const dates = [];
    const projectedInflow = [];
    const projectedOutflow = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
      projectedInflow.push(0); // Real projection requires proper logic, returning 0 for now to avoid fake data
      projectedOutflow.push(0);
    }

    const summary: DashboardSummary = {
      kpis: {
        totalRevenue,
        revenueGrowthMoM: 0, // Should be calculated from DB
        totalOutstanding,
        overdueAmount,
        paidInvoicesCount: paidCount,
        pendingInvoicesCount: pendingCount,
        activeCustomersCount: customers.length,
      },
      cashflowProjection: {
        dates,
        projectedInflow,
        projectedOutflow,
      },
      recentInvoices: invoices.slice(0, 6),
      anomalies: anomalies.slice(0, 5),
      aiDailyBrief: {
        greeting: `Good day! Here is your AI financial intelligence overview.`,
        summaryBullets: [
          `Total invoiced volume stands at ₹${totalRevenue.toLocaleString()} across ${invoices.length} transactions.`,
          `₹${totalCollected.toLocaleString()} collected to date, with ₹${totalOutstanding.toLocaleString()} receivables pending.`,
          overdueInvoices.length > 0
            ? `⚠️ ${overdueInvoices.length} invoice(s) are overdue totaling ₹${overdueAmount.toLocaleString()}.`
            : `✅ No overdue accounts detected. All current receivables are within payment terms.`,
        ],
        priorityActions: [
          ...(overdueInvoices.length > 0
            ? [
                {
                  action: `Dispatch smart reminder for overdue invoice #${overdueInvoices[0].invoiceNumber} (₹${overdueInvoices[0].amountDue.toLocaleString()})`,
                  urgency: 'high' as const,
                  linkTo: `/invoices/${overdueInvoices[0]._id}`,
                },
              ]
            : []),
          {
            action: `Review and finalize ${pendingCount} pending/draft invoice(s)`,
            urgency: 'medium' as const,
            linkTo: '/invoices',
          },
          {
            action: 'Explore AI Copilot for fast natural-language invoice generation',
            urgency: 'low' as const,
            linkTo: '/invoices/create',
          },
        ],
      },
    };

    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

export async function getRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { startDate, endDate, groupBy = 'month' } = req.query;

    const invoices = await InvoiceModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: { $nin: ['draft', 'cancelled', 'void'] },
      ...(startDate && endDate && { issueDate: { $gte: String(startDate), $lte: String(endDate) } }),
    }).sort({ issueDate: 1 });

    const groupedData: Record<string, { period: string; totalRevenue: number; taxTotal: number; invoiceCount: number }> = {};

    invoices.forEach((inv) => {
      const periodKey = groupBy === 'day' ? inv.issueDate : inv.issueDate.substring(0, 7); // YYYY-MM
      if (!groupedData[periodKey]) {
        groupedData[periodKey] = { period: periodKey, totalRevenue: 0, taxTotal: 0, invoiceCount: 0 };
      }
      groupedData[periodKey].totalRevenue += inv.grandTotal;
      groupedData[periodKey].taxTotal += inv.taxTotal;
      groupedData[periodKey].invoiceCount += 1;
    });

    res.json({ success: true, data: Object.values(groupedData) });
  } catch (err) {
    next(err);
  }
}

export async function getARAgingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const now = new Date();

    const openInvoices = await InvoiceModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      amountDue: { $gt: 0 },
      status: { $nin: ['draft', 'cancelled', 'void'] },
    }).lean();

    const buckets = {
      current: { label: 'Current (0-30 days)', amount: 0, count: 0, invoices: [] as any[] },
      days30to60: { label: '31-60 days overdue', amount: 0, count: 0, invoices: [] as any[] },
      days60to90: { label: '61-90 days overdue', amount: 0, count: 0, invoices: [] as any[] },
      days90Plus: { label: '90+ days overdue', amount: 0, count: 0, invoices: [] as any[] },
    };

    openInvoices.forEach((inv) => {
      const dueDate = new Date(inv.dueDate);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

      const summary = {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerSnapshot?.name,
        amountDue: inv.amountDue,
        dueDate: inv.dueDate,
        daysOverdue: Math.max(0, diffDays),
      };

      if (diffDays <= 0) {
        buckets.current.amount += inv.amountDue;
        buckets.current.count += 1;
        buckets.current.invoices.push(summary);
      } else if (diffDays <= 30) {
        buckets.days30to60.amount += inv.amountDue;
        buckets.days30to60.count += 1;
        buckets.days30to60.invoices.push(summary);
      } else if (diffDays <= 60) {
        buckets.days60to90.amount += inv.amountDue;
        buckets.days60to90.count += 1;
        buckets.days60to90.invoices.push(summary);
      } else {
        buckets.days90Plus.amount += inv.amountDue;
        buckets.days90Plus.count += 1;
        buckets.days90Plus.invoices.push(summary);
      }
    });

    const totalOverdue = buckets.days30to60.amount + buckets.days60to90.amount + buckets.days90Plus.amount;
    const totalReceivables = buckets.current.amount + totalOverdue;

    res.json({
      success: true,
      data: {
        totalReceivables: Math.round(totalReceivables * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        buckets,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const customerId = req.params.customerId;

    const [customer, invoices, payments] = await Promise.all([
      CustomerModel.findOne({ _id: customerId, organizationId: new mongoose.Types.ObjectId(orgId) }),
      InvoiceModel.find({ customerId, organizationId: new mongoose.Types.ObjectId(orgId) }).sort({ issueDate: 1 }),
      PaymentModel.find({ customerId, organizationId: new mongoose.Types.ObjectId(orgId) }).sort({ paymentDate: 1 }),
    ]);

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const ledger: any[] = [];
    invoices.forEach((inv) => {
      ledger.push({
        date: inv.issueDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        debit: inv.grandTotal,
        credit: 0,
        status: inv.status,
      });
    });

    payments.forEach((pay) => {
      ledger.push({
        date: pay.paymentDate,
        type: 'PAYMENT',
        reference: pay.transactionReference || `PAY-${String(pay._id).substring(18)}`,
        debit: 0,
        credit: pay.amount,
        status: pay.status,
      });
    });

    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const statement = ledger.map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return { ...entry, runningBalance: Math.round(runningBalance * 100) / 100 };
    });

    res.json({
      success: true,
      data: {
        customer,
        currentOutstanding: customer.outstandingBalance,
        ledger: statement,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTopCustomersReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const customers = await CustomerModel.find({ organizationId: new mongoose.Types.ObjectId(orgId), isActive: true })
      .sort({ outstandingBalance: -1 })
      .limit(10);
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

export async function getProfitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { startDate, endDate } = req.query;

    const invoiceQuery: any = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: { $nin: ['draft', 'cancelled', 'void'] },
    };
    const returnQuery: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    const expenseQuery: any = { organizationId: new mongoose.Types.ObjectId(orgId) };

    if (startDate && endDate) {
      invoiceQuery.issueDate = { $gte: String(startDate), $lte: String(endDate) };
      returnQuery.date = { $gte: String(startDate), $lte: String(endDate) };
      expenseQuery.date = { $gte: String(startDate), $lte: String(endDate) };
    }

    const [invoices, returns, expenses, products] = await Promise.all([
      InvoiceModel.find(invoiceQuery).lean(),
      ReturnModel.find(returnQuery).lean(),
      ExpenseModel.find(expenseQuery).lean(),
      ProductModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) }).lean(),
    ]);

    const productCostMap = new Map<string, number>();
    products.forEach((p) => {
      productCostMap.set(String(p._id), p.costPrice || 0);
    });

    let grossSales = 0;
    let totalDiscounts = 0;
    let totalTaxCollected = 0;
    let totalCOGS = 0;

    for (const inv of invoices) {
      grossSales += inv.subtotal || 0;
      totalDiscounts += inv.discountTotal || 0;
      totalTaxCollected += inv.taxTotal || 0;

      if (inv.items) {
        for (const item of inv.items) {
          const cost = (item.productId ? productCostMap.get(String(item.productId)) : 0) || 0;
          totalCOGS += (item.quantity || 0) * cost;
        }
      }
    }

    const totalRefunds = returns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
    const totalOperatingExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const netSales = grossSales - totalDiscounts - totalRefunds;
    const grossProfit = netSales - totalCOGS;
    const netProfit = grossProfit - totalOperatingExpenses;
    const grossMarginPercent = netSales > 0 ? Math.round((grossProfit / netSales) * 10000) / 100 : 0;
    const netMarginPercent = netSales > 0 ? Math.round((netProfit / netSales) * 10000) / 100 : 0;

    res.json({
      success: true,
      data: {
        grossSales: Math.round(grossSales * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        grossMarginPercent,
        netMarginPercent,
        totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
        transactionCount: invoices.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getBestSellersReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { limit = 10 } = req.query;

    const invoices = await InvoiceModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: { $nin: ['draft', 'cancelled', 'void'] },
    }).lean();

    const aggregation = new Map<string, { name: string; sku?: string; unitsSold: number; totalRevenue: number }>();

    for (const inv of invoices) {
      if (inv.items) {
        for (const item of inv.items) {
          const key = item.sku || String(item.productId || item.description);
          const current = aggregation.get(key) || {
            name: item.description,
            sku: item.sku,
            unitsSold: 0,
            totalRevenue: 0,
          };
          current.unitsSold += item.quantity || 0;
          current.totalRevenue += item.lineTotal || 0;
          aggregation.set(key, current);
        }
      }
    }

    const sorted = Array.from(aggregation.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, Number(limit));

    res.json({ success: true, data: sorted });
  } catch (err) {
    next(err);
  }
}

export async function getGSTSummaryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { startDate, endDate } = req.query;

    const query: any = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: { $nin: ['draft', 'cancelled', 'void'] },
    };
    if (startDate && endDate) {
      query.issueDate = { $gte: String(startDate), $lte: String(endDate) };
    }

    const invoices = await InvoiceModel.find(query).lean();

    let totalTaxable = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalTax = 0;

    const hsnSummaryMap = new Map<string, { hsn: string; taxable: number; taxAmount: number }>();
    const rateBreakdownMap = new Map<number, { rate: number; taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

    for (const inv of invoices) {
      const invoiceTaxable = Math.max(0, (inv.subtotal || 0) - (inv.discountTotal || 0));
      totalTaxable += invoiceTaxable;

      if (inv.taxBreakdown && inv.taxBreakdown.length > 0) {
        for (const tb of inv.taxBreakdown) {
          totalTax += tb.taxAmount || 0;
          if (tb.taxType === 'CGST') cgstTotal += tb.taxAmount || 0;
          else if (tb.taxType === 'SGST') sgstTotal += tb.taxAmount || 0;
          else if (tb.taxType === 'IGST') igstTotal += tb.taxAmount || 0;
        }
      } else if (inv.taxTotal) {
        totalTax += inv.taxTotal;
      }

      if (inv.items) {
        for (const item of inv.items) {
          const rawRate = Number(item.taxRate) || 0;
          const rPercent = rawRate <= 1 ? Math.round(rawRate * 100) : Math.round(rawRate);
          const itemTaxable = Math.max(0, (item.lineTotal || 0) - (item.taxAmount || 0));
          const itemTax = item.taxAmount || 0;

          const rExisting = rateBreakdownMap.get(rPercent) || {
            rate: rPercent,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
          };
          rExisting.taxableValue += itemTaxable;
          rExisting.totalTax += itemTax;

          const hasIgst = inv.taxBreakdown?.some(tb => tb.taxType === 'IGST');
          if (hasIgst) {
            rExisting.igst += itemTax;
          } else {
            rExisting.cgst += Math.round((itemTax / 2) * 100) / 100;
            rExisting.sgst += Math.round((itemTax / 2) * 100) / 100;
          }
          rateBreakdownMap.set(rPercent, rExisting);

          const hsn = item.hsnSacCode || 'N/A';
          const existing = hsnSummaryMap.get(hsn) || { hsn, taxable: 0, taxAmount: 0 };
          existing.taxable += itemTaxable;
          existing.taxAmount += itemTax;
          hsnSummaryMap.set(hsn, existing);
        }
      }
    }

    const summaryData = {
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      cgstTotal: Math.round(cgstTotal * 100) / 100,
      sgstTotal: Math.round(sgstTotal * 100) / 100,
      igstTotal: Math.round(igstTotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoiceCount: invoices.length,
    };

    res.json({
      success: true,
      data: {
        summary: summaryData,
        // Also provide top-level aliases for direct access
        totalTaxable: summaryData.totalTaxable,
        totalTaxableValue: summaryData.totalTaxable,
        cgstTotal: summaryData.cgstTotal,
        totalCGST: summaryData.cgstTotal,
        sgstTotal: summaryData.sgstTotal,
        totalSGST: summaryData.sgstTotal,
        igstTotal: summaryData.igstTotal,
        totalTax: summaryData.totalTax,
        invoiceCount: summaryData.invoiceCount,
        breakdown: Array.from(rateBreakdownMap.values()),
        rateBreakdown: Array.from(rateBreakdownMap.values()),
        hsnSummary: Array.from(hsnSummaryMap.values()),
      },
    });
  } catch (err) {
    next(err);
  }
}
