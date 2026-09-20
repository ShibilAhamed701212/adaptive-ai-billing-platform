import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ReturnModel } from '../../models/Return.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { ProductModel } from '../../models/Product.model';
import { PaymentModel } from '../../models/Payment.model';
import { CustomerModel } from '../../models/Customer.model';
import { InventoryMovementModel } from '../../models/InventoryMovement.model';
import { StoreCreditTransactionModel } from '../../models/StoreCreditTransaction.model';
import { LedgerTransactionModel } from '../../models/LedgerTransaction.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { invoiceId, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (invoiceId) query.invoiceId = new mongoose.Types.ObjectId(String(invoiceId));

    const skip = (Number(page) - 1) * Number(limit);
    const [returns, total] = await Promise.all([
      ReturnModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ReturnModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: returns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function processReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { invoiceId, items, refundMethod, reason } = req.body;

    if (!invoiceId || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invoice ID and return items are required');
    }

    const invoice = await InvoiceModel.findOne({
      _id: invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    if (!invoice) throw new Error('Original invoice not found');

    // Fetch prior returns for this invoice to prevent returning more than purchased
    const previousReturns = await ReturnModel.find({
      invoiceId: invoice._id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    const alreadyReturnedMap = new Map<string, number>();
    for (const pr of previousReturns) {
      for (const item of pr.items) {
        const key = String(item.productId);
        alreadyReturnedMap.set(key, (alreadyReturnedMap.get(key) || 0) + item.quantityReturned);
      }
    }

    let totalRefundAmount = 0;
    const returnItems = [];

    for (const returnReq of items) {
      const invItem = invoice.items.find(
        (i: any) => String(i.productId || i._id) === String(returnReq.productId) || i.sku === returnReq.sku
      );
      if (!invItem) {
        throw new Error(`Item ${returnReq.name || returnReq.productId} was not found on the original invoice`);
      }

      const prodIdStr = String(invItem.productId || returnReq.productId);
      const previouslyReturned = alreadyReturnedMap.get(prodIdStr) || 0;
      const maxReturnable = invItem.quantity - previouslyReturned;

      if (returnReq.quantity > maxReturnable) {
        throw new Error(
          `Cannot return ${returnReq.quantity} of ${invItem.description}. Max returnable is ${maxReturnable} (already returned: ${previouslyReturned})`
        );
      }

      const unitPrice = invItem.unitPrice;
      const taxRate = invItem.taxRate || 0;
      const lineSubtotal = unitPrice * returnReq.quantity;
      const lineTax = lineSubtotal * taxRate;
      const refundTotal = lineSubtotal + lineTax;

      totalRefundAmount += refundTotal;

      returnItems.push({
        productId: new mongoose.Types.ObjectId(prodIdStr),
        sku: invItem.sku,
        name: invItem.description,
        quantityReturned: Number(returnReq.quantity),
        unitPrice,
        taxRate,
        taxAmount: lineTax,
        refundTotal,
        reason: returnReq.reason || reason || 'Customer return',
        restock: returnReq.restock !== false,
      });

      // Stock restoration & Inventory movement
      if (returnReq.restock !== false) {
        const product = await ProductModel.findOne({
          _id: prodIdStr,
          organizationId: new mongoose.Types.ObjectId(orgId),
        }).session(session);

        if (product && product.manageInventory) {
          const previousStock = product.stockQuantity || 0;
          const newStock = previousStock + Number(returnReq.quantity);
          product.stockQuantity = newStock;
          await product.save({ session });

          const movement = new InventoryMovementModel({
            organizationId: new mongoose.Types.ObjectId(orgId),
            productId: product._id,
            userId: new mongoose.Types.ObjectId(userId),
            type: 'RETURN',
            quantity: Number(returnReq.quantity),
            previousStock,
            newStock,
            referenceId: String(invoice._id),
            referenceModel: 'Invoice',
            notes: `Return on invoice #${invoice.invoiceNumber}`,
          });
          await movement.save({ session });
        }
      }
    }

    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    // Process refund method
    if (refundMethod === 'store_credit') {
      if (!invoice.customerId) throw new Error('Store credit refund requires a registered customer');
      const customer = await CustomerModel.findOne({
        _id: invoice.customerId,
        organizationId: new mongoose.Types.ObjectId(orgId),
      }).session(session);

      if (customer) {
        customer.storeCreditBalance = (customer.storeCreditBalance || 0) + totalRefundAmount;
        await customer.save({ session });

        const scTx = new StoreCreditTransactionModel({
          organizationId: new mongoose.Types.ObjectId(orgId),
          customerId: customer._id,
          userId: new mongoose.Types.ObjectId(userId),
          type: 'ISSUE',
          amount: totalRefundAmount,
          balanceAfter: customer.storeCreditBalance,
          referenceId: String(invoice._id),
          referenceModel: 'Invoice',
          notes: `Refund issued for return #${returnNumber}`,
        });
        await scTx.save({ session });
      }
    } else if (refundMethod === 'customer_balance') {
      if (!invoice.customerId) throw new Error('Customer balance adjustment requires a customer');
      const customer = await CustomerModel.findOne({
        _id: invoice.customerId,
        organizationId: new mongoose.Types.ObjectId(orgId),
      }).session(session);

      if (customer) {
        customer.outstandingBalance = (customer.outstandingBalance || 0) - totalRefundAmount;
        await customer.save({ session });

        const ledger = new LedgerTransactionModel({
          organizationId: new mongoose.Types.ObjectId(orgId),
          customerId: customer._id,
          type: 'RETURN',
          amount: -totalRefundAmount,
          balanceAfter: customer.outstandingBalance,
          referenceId: String(invoice._id),
          referenceModel: 'Invoice',
          notes: `Credit adjustment for return #${returnNumber}`,
          date: new Date().toISOString(),
        });
        await ledger.save({ session });
      }
    } else {
    // Direct payment refund record (Cash, Card, UPI)
    if (!req.body.isExchange) {
      const refundPayment = new PaymentModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        invoiceId: invoice._id,
        customerId: invoice.customerId || null,
        amount: -totalRefundAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: refundMethod || 'cash',
        status: 'refunded',
        reference: returnNumber,
        notes: `Refund payout for return #${returnNumber}`,
      });
      await refundPayment.save({ session });
    }
  }

  // Handle Exchange Items if this is an exchange
  let newItemsTotal = 0;
  if (req.body.isExchange && Array.isArray(req.body.exchangeItems) && req.body.exchangeItems.length > 0) {
    for (const exItem of req.body.exchangeItems) {
      const exProd = await ProductModel.findOne({
        _id: exItem.productId,
        organizationId: new mongoose.Types.ObjectId(orgId),
      }).session(session);

      if (!exProd) throw new Error(`Exchange product ${exItem.name || exItem.productId} not found`);

      const qty = Number(exItem.quantity) || 1;
      const unitPrice = Number(exItem.unitPrice) || exProd.unitPrice;
      const lineTotal = unitPrice * qty;
      newItemsTotal += lineTotal;

      // Inventory deduction for replacement item
      if (exProd.manageInventory) {
        const previousStock = exProd.stockQuantity || 0;
        if (previousStock < qty) {
          throw new Error(`Insufficient stock for replacement product ${exProd.name}. Available: ${previousStock}, Requested: ${qty}`);
        }
        exProd.stockQuantity = previousStock - qty;
        await exProd.save({ session });

        const movement = new InventoryMovementModel({
          organizationId: new mongoose.Types.ObjectId(orgId),
          productId: exProd._id,
          userId: new mongoose.Types.ObjectId(userId),
          type: 'EXCHANGE_OUT',
          quantity: -qty,
          previousStock,
          newStock: exProd.stockQuantity,
          referenceId: String(invoice._id),
          referenceModel: 'Invoice',
          notes: `Exchange replacement on return #${returnNumber}`,
        });
        await movement.save({ session });
      }
    }

    const difference = newItemsTotal - totalRefundAmount;
    if (difference !== 0) {
      const diffSettledVia = req.body.differenceSettledVia || refundMethod || 'cash';
      const payment = new PaymentModel({
        organizationId: new mongoose.Types.ObjectId(orgId),
        invoiceId: invoice._id,
        customerId: invoice.customerId || null,
        amount: difference,
        paymentDate: new Date().toISOString(),
        paymentMethod: diffSettledVia,
        status: difference > 0 ? 'completed' : 'refunded',
        reference: returnNumber,
        notes: difference > 0 ? `Exchange difference collected for return #${returnNumber}` : `Exchange difference refunded for return #${returnNumber}`,
      });
      await payment.save({ session });
    }
  }

  const returnDoc = new ReturnModel({
    organizationId: new mongoose.Types.ObjectId(orgId),
    invoiceId: invoice._id,
    returnNumber,
    date: new Date().toISOString().split('T')[0],
    items: returnItems,
    totalRefundAmount,
    refundMethod,
    isExchange: !!req.body.isExchange,
    exchangeDetails: req.body.isExchange ? {
      newItemsTotal,
      difference: newItemsTotal - totalRefundAmount,
      differenceSettledVia: req.body.differenceSettledVia || refundMethod,
    } : undefined,
    userId: new mongoose.Types.ObjectId(userId),
  });

  await returnDoc.save({ session });

  await logAuditEvent({
    organizationId: orgId,
    userId,
    userEmail: req.tenant!.email,
    action: req.body.isExchange ? 'PROCESS_EXCHANGE' : 'PROCESS_RETURN',
    entityType: 'Return',
    entityId: String(returnDoc._id),
    details: { 
      returnNumber, 
      invoiceNumber: invoice.invoiceNumber, 
      totalRefundAmount, 
      refundMethod, 
      isExchange: !!req.body.isExchange,
      difference: req.body.isExchange ? newItemsTotal - totalRefundAmount : undefined 
    },
  });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: returnDoc });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}
