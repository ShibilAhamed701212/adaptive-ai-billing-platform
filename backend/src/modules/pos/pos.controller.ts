import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { InvoiceModel } from '../../models/Invoice.model';
import { PaymentModel } from '../../models/Payment.model';
import { ProductModel } from '../../models/Product.model';
import { CustomerModel } from '../../models/Customer.model';
import { OrganizationModel } from '../../models/Organization.model';
import { InventoryMovementModel } from '../../models/InventoryMovement.model';
import { LedgerTransactionModel } from '../../models/LedgerTransaction.model';
import { StoreCreditTransactionModel } from '../../models/StoreCreditTransaction.model';
import { LoyaltyTransactionModel } from '../../models/LoyaltyTransaction.model';
import { logAuditEvent } from '../../core/audit/audit.service';
import { calculateInvoice } from '../../billing-engine/calculators/invoice-calculator';

export async function posCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const {
      customerId,
      items,
      payments,
      notes,
      splitPayments,
      invoiceDiscountAmount = 0,
      amountTendered,
      changeGiven,
      shiftId,
      clientTransactionId,
    } = req.body;

    if (clientTransactionId) {
      const existingInvoice = await InvoiceModel.findOne({ 
        organizationId: new mongoose.Types.ObjectId(orgId),
        clientTransactionId 
      }).session(session);

      if (existingInvoice) {
        await session.abortTransaction();
        session.endSession();
        res.status(200).json({ success: true, data: { invoice: existingInvoice, payments: existingInvoice.paymentHistory || [] }, message: 'Idempotent request: Sale already processed' });
        return;
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided');
    }

    const org = await OrganizationModel.findById(orgId).session(session);
    if (!org) throw new Error('Organization not found');

    let customer = null;
    if (customerId) {
      customer = await CustomerModel.findOne({ _id: customerId, organizationId: new mongoose.Types.ObjectId(orgId) }).session(session);
      if (!customer) throw new Error('Customer not found');
    }

    // 1. Reload & validate products, check stock
    const productIds = items.map(item => item.productId);
    const dbProducts = await ProductModel.find({ 
      _id: { $in: productIds }, 
      organizationId: new mongoose.Types.ObjectId(orgId) 
    }).session(session);
    
    const productMap = new Map(dbProducts.map(p => [String(p._id), p]));

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) throw new Error(`Product not found: ${item.productId}`);
      if (!dbProduct.isActive) throw new Error(`Product is inactive: ${dbProduct.name}`);
      
      // Stock check
      if (dbProduct.manageInventory) {
        const stock = dbProduct.stockQuantity || 0;
        if (stock < item.quantity) {
          throw new Error(`Insufficient stock for ${dbProduct.name}. Requested: ${item.quantity}, Available: ${stock}`);
        }
      }
    }

    // 2. Prepare items for calculation
    const calcItems = items.map((item: any) => {
      const dbProduct = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        sku: dbProduct.sku,
        description: dbProduct.name,
        unit: dbProduct.unit || 'unit',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice !== undefined ? item.unitPrice : dbProduct.unitPrice),
        discountAmount: Number(item.discountAmount) || 0,
        taxRate: Number(dbProduct.taxRate !== undefined ? dbProduct.taxRate : 0.18),
        hsnSacCode: dbProduct.hsnSacCode,
      };
    });

    const { items: processedItems, totals } = calculateInvoice(calcItems, {
      taxSystem: org.settings.taxSystem,
      originState: org.settings.address?.state,
      destinationState: customer?.billingAddress?.state,
      invoiceDiscountAmount: Number(invoiceDiscountAmount) || 0,
    });

    // 3. Handle payments, loyalty points redemption, and validate totals
    const POINTS_PER_RUPEE = 1; // 1 Loyalty Point = ₹1.00 (Authoritative server-side conversion)
    let pointsToRedeem = Number(req.body.loyaltyPointsRedeemed) || 0;
    const allPayments = [...(splitPayments || [])];
    const loyaltyPayment = allPayments.find((p: any) => p.method === 'loyalty_points');
    if (loyaltyPayment && !pointsToRedeem) {
      pointsToRedeem = Math.round(Number(loyaltyPayment.amount) * POINTS_PER_RUPEE);
    }
    const loyaltyRupeeValue = pointsToRedeem / POINTS_PER_RUPEE;

    if (pointsToRedeem > 0) {
      if (!customer) {
        throw new Error('Loyalty points redemption requires a selected customer');
      }
      if ((customer.loyaltyPoints || 0) < pointsToRedeem) {
        throw new Error(`Insufficient loyalty points. Available: ${customer.loyaltyPoints || 0} pts, Requested: ${pointsToRedeem} pts`);
      }
      if (loyaltyRupeeValue > totals.grandTotal) {
        throw new Error(`Loyalty redemption value (₹${loyaltyRupeeValue}) cannot exceed invoice total (₹${totals.grandTotal})`);
      }
      if (!loyaltyPayment) {
        allPayments.push({ method: 'loyalty_points', amount: loyaltyRupeeValue });
      }
    }

    const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const amountDue = Math.max(0, totals.grandTotal - totalPaid);

    let status = 'paid';
    if (amountDue > 0) {
      status = 'partially_paid';
      if (!customer) {
        throw new Error('Credit sale requires a selected customer');
      }
    }

    // Check store credit payment balance
    for (const sp of allPayments) {
      if (sp.method === 'store_credit') {
        if (!customer) throw new Error('Store credit payment requires a selected customer');
        if ((customer.storeCreditBalance || 0) < Number(sp.amount)) {
          throw new Error(`Insufficient store credit. Available: ₹${customer.storeCreditBalance || 0}, Requested: ₹${sp.amount}`);
        }
      }
    }
    
    // 4. Create Invoice
    const prefix = org.settings.invoicePrefix || 'INV';
    const nextSeq = org.settings.nextInvoiceNumber || 1001;
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${nextSeq}`;

    await OrganizationModel.findByIdAndUpdate(orgId, { $inc: { 'settings.nextInvoiceNumber': 1 } }, { session });

    // Auto-detect active shift if not explicitly provided
    let finalShiftId = shiftId ? new mongoose.Types.ObjectId(shiftId) : undefined;
    if (!finalShiftId) {
      const { ShiftModel } = require('../../models/Shift.model');
      const activeShift = await ShiftModel.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        userId: new mongoose.Types.ObjectId(userId),
        status: 'OPEN',
      }).session(session);
      if (activeShift) {
        finalShiftId = activeShift._id;
      }
    }

    const invoice = new InvoiceModel({
      organizationId: new mongoose.Types.ObjectId(orgId),
      invoiceNumber,
      customerId: customer ? customer._id : null,
      customerSnapshot: customer ? {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        companyName: customer.companyName,
        gstinOrTaxId: customer.gstinOrTaxId,
        billingAddress: customer.billingAddress,
      } : { name: 'Walk-in Customer', email: 'walkin@example.com' },
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      currency: org.settings.currency || 'INR',
      currencySymbol: org.settings.currencySymbol || '₹',
      items: processedItems,
      subtotal: totals.rawSubtotal,
      discountTotal: totals.totalDiscount,
      taxTotal: totals.taxTotal,
      taxBreakdown: totals.taxBreakdown,
      grandTotal: totals.grandTotal,
      amountPaid: totalPaid,
      amountDue: amountDue,
      amountTendered: amountTendered !== undefined ? Number(amountTendered) : totalPaid,
      changeGiven: changeGiven !== undefined ? Number(changeGiven) : 0,
      shiftId: finalShiftId,
      status: status,
      notes: notes || 'POS Sale',
      createdBy: new mongoose.Types.ObjectId(userId),
      clientTransactionId: clientTransactionId || undefined,
      loyaltyPointsRedeemed: pointsToRedeem,
      loyaltyDiscountAmount: loyaltyRupeeValue,
    });

    await invoice.save({ session });

    // 5. Create Payments & process store credit and loyalty redemptions
    const paymentRecords = [];
    for (const sp of allPayments) {
      if (sp.amount <= 0) continue;
      
      const payment = new PaymentModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        invoiceId: invoice._id,
        customerId: customer ? customer._id : null,
        amount: sp.amount,
        paymentDate: new Date().toISOString(),
        paymentMethod: sp.method,
        status: 'completed',
        reference: invoiceNumber,
        notes: sp.method === 'loyalty_points' ? `Loyalty Points Redemption (${pointsToRedeem} pts)` : 'POS Split Payment'
      });
      await payment.save({ session });
      paymentRecords.push({ paymentId: String(payment._id), amount: Number(sp.amount), paymentDate: payment.paymentDate, method: String(sp.method), reference: invoiceNumber });

      if (sp.method === 'store_credit' && customer) {
        customer.storeCreditBalance = (customer.storeCreditBalance || 0) - Number(sp.amount);
        await customer.save({ session });

        const scTx = new StoreCreditTransactionModel({
          organizationId: new mongoose.Types.ObjectId(orgId),
          customerId: customer._id,
          userId: new mongoose.Types.ObjectId(userId),
          type: 'REDEMPTION',
          amount: -Number(sp.amount),
          balanceAfter: customer.storeCreditBalance,
          referenceId: String(invoice._id),
          referenceModel: 'Invoice',
          notes: `Redemption for invoice #${invoiceNumber}`,
        });
        await scTx.save({ session });
      }
    }

    // Atomic Loyalty Points Deduction
    if (pointsToRedeem > 0 && customer) {
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) - pointsToRedeem;
      await customer.save({ session });

      const loyaltyTx = new LoyaltyTransactionModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        customerId: customer._id,
        userId: new mongoose.Types.ObjectId(userId),
        type: 'REDEMPTION',
        points: -pointsToRedeem,
        pointsValueInRupees: loyaltyRupeeValue,
        balanceAfter: customer.loyaltyPoints,
        referenceId: String(invoice._id),
        referenceModel: 'Invoice',
        notes: `Redeemed ${pointsToRedeem} loyalty points (₹${loyaltyRupeeValue}) for invoice #${invoiceNumber}`,
      });
      await loyaltyTx.save({ session });
    }

    // Award loyalty points on net non-loyalty spend (1 point per ₹100 spent)
    const netSpentForAccrual = Math.max(0, totals.grandTotal - loyaltyRupeeValue);
    if (customer && netSpentForAccrual >= 100) {
      const pointsEarned = Math.floor(netSpentForAccrual / 100);
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) + pointsEarned;
      await customer.save({ session });

      const accrualTx = new LoyaltyTransactionModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        customerId: customer._id,
        userId: new mongoose.Types.ObjectId(userId),
        type: 'ACCRUAL',
        points: pointsEarned,
        pointsValueInRupees: pointsEarned / POINTS_PER_RUPEE,
        balanceAfter: customer.loyaltyPoints,
        referenceId: String(invoice._id),
        referenceModel: 'Invoice',
        notes: `Earned ${pointsEarned} loyalty points from invoice #${invoiceNumber}`,
      });
      await accrualTx.save({ session });
    }
    
    invoice.customerLoyaltyPointsBalance = customer ? customer.loyaltyPoints : 0;
    if (paymentRecords.length > 0) {
      invoice.paymentHistory = paymentRecords;
    }
    await invoice.save({ session });

    // 6. Inventory Deduction & Movement
    for (const item of items) {
      const dbProduct = productMap.get(item.productId)!;
      if (dbProduct.manageInventory) {
        const previousStock = dbProduct.stockQuantity || 0;
        const newStock = previousStock - item.quantity;
        
        dbProduct.stockQuantity = newStock;
        await dbProduct.save({ session });

        const movement = new InventoryMovementModel({
          organizationId: new mongoose.Types.ObjectId(orgId),
          productId: dbProduct._id,
          userId: new mongoose.Types.ObjectId(userId),
          type: 'SALE',
          quantity: -item.quantity,
          previousStock,
          newStock,
          referenceId: String(invoice._id),
          referenceModel: 'Invoice',
          notes: `POS Sale: ${invoiceNumber}`
        });
        await movement.save({ session });
      }
    }

    // 7. Customer Ledger if credit (amountDue > 0)
    if (customer && amountDue > 0) {
      const balanceAfter = customer.outstandingBalance + amountDue;
      customer.outstandingBalance = balanceAfter;
      await customer.save({ session });

      const ledger = new LedgerTransactionModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        customerId: customer._id,
        type: 'SALE',
        amount: amountDue,
        balanceAfter,
        referenceId: String(invoice._id),
        referenceModel: 'Invoice',
        notes: `Credit Sale: ${invoiceNumber}`,
        date: new Date().toISOString()
      });
      await ledger.save({ session });
    }

    // 8. Audit Log
    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'POS_CHECKOUT',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      details: { invoiceNumber, grandTotal: totals.grandTotal, totalPaid, amountDue, clientTransactionId },
      session
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        invoice,
        payments: paymentRecords
      }
    });

  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}
