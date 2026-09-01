import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { PaymentModel } from '../../models/Payment.model';
import { AskBusinessQueryResponse } from '@billing/shared';
import mongoose from 'mongoose';

export async function processAskBusinessQuery(
  organizationId: string,
  query: string
): Promise<AskBusinessQueryResponse> {
  const orgObjId = new mongoose.Types.ObjectId(organizationId);
  const lowerQuery = query.toLowerCase();

  // Aggregation tools
  const [totalInvoices, totalPayments, customers] = await Promise.all([
    InvoiceModel.find({ organizationId: orgObjId }).lean(),
    PaymentModel.find({ organizationId: orgObjId }).lean(),
    CustomerModel.find({ organizationId: orgObjId }).lean(),
  ]);

  const totalRevenue = totalInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalCollected = totalPayments.reduce((sum, pay) => sum + pay.amount, 0);
  const totalOutstanding = totalInvoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
  const overdueInvoices = totalInvoices.filter((inv) => inv.status === 'overdue' || inv.amountDue > 0);

  if (lowerQuery.includes('revenue') || lowerQuery.includes('sales') || lowerQuery.includes('earned')) {
    return {
      answer: `Your total invoiced revenue across ${totalInvoices.length} invoices is **₹${totalRevenue.toLocaleString()}**, with **₹${totalCollected.toLocaleString()}** successfully collected and **₹${totalOutstanding.toLocaleString()}** outstanding.`,
      chartData: {
        labels: ['Collected', 'Outstanding'],
        datasets: [
          {
            label: 'Revenue Breakdown (₹)',
            data: [totalCollected, totalOutstanding],
          },
        ],
      },
      sourcesUsed: ['invoices collection', 'payments collection'],
      suggestedFollowUps: [
        'Which customer has the highest overdue balance?',
        'Show cashflow forecast for next 30 days',
      ],
    };
  }

  if (lowerQuery.includes('overdue') || lowerQuery.includes('unpaid') || lowerQuery.includes('late')) {
    const topOverdue = [...totalInvoices]
      .filter((i) => i.amountDue > 0)
      .sort((a, b) => b.amountDue - a.amountDue)
      .slice(0, 5);

    const customerNames = topOverdue.map((i) => i.customerSnapshot?.name || 'Customer');
    const amounts = topOverdue.map((i) => i.amountDue);

    return {
      answer: `You have **${overdueInvoices.length} outstanding/overdue invoice(s)** totaling **₹${totalOutstanding.toLocaleString()}**. The highest outstanding balance is from **${customerNames[0] || 'N/A'}** with **₹${(amounts[0] || 0).toLocaleString()}**.`,
      chartData: {
        labels: customerNames,
        datasets: [
          {
            label: 'Amount Due (₹)',
            data: amounts,
          },
        ],
      },
      sourcesUsed: ['invoices.status: overdue', 'invoices.amountDue > 0'],
      suggestedFollowUps: [
        'Generate payment reminder for top debtor',
        'Show AI payment delay predictions',
      ],
    };
  }

  if (lowerQuery.includes('customer') || lowerQuery.includes('client')) {
    return {
      answer: `You have **${customers.length} active customers** in the system. Overall outstanding receivables across all accounts stand at **₹${totalOutstanding.toLocaleString()}**.`,
      chartData: {
        labels: customers.slice(0, 5).map((c) => c.name),
        datasets: [
          {
            label: 'Outstanding Balance (₹)',
            data: customers.slice(0, 5).map((c) => c.outstandingBalance || 0),
          },
        ],
      },
      sourcesUsed: ['customers collection'],
      suggestedFollowUps: [
        'Who are our top 5 revenue-generating clients?',
        'Show customer credit limit utilization',
      ],
    };
  }

  // Default general response
  return {
    answer: `Overview for your organization: **₹${totalRevenue.toLocaleString()}** total invoiced, **₹${totalCollected.toLocaleString()}** collected, **${customers.length}** customers, and **${overdueInvoices.length}** invoices awaiting settlement.`,
    chartData: {
      labels: ['Invoiced', 'Collected', 'Receivables'],
      datasets: [
        {
          label: 'Financial Snapshot (₹)',
          data: [totalRevenue, totalCollected, totalOutstanding],
        },
      ],
    },
    sourcesUsed: ['financial aggregates', 'tenant scoped reports'],
    suggestedFollowUps: [
      'What is my total revenue this month?',
      'Which invoices are currently overdue?',
      'Show late payment risk alerts',
    ],
  };
}
