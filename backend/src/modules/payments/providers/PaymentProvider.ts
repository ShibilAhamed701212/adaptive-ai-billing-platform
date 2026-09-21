import { InvoiceModel } from '../../../models/Invoice.model';
import { PaymentModel } from '../../../models/Payment.model';
import mongoose from 'mongoose';

export interface PaymentIntent {
  id: string;
  status: 'requires_payment_method' | 'succeeded' | 'failed' | 'pending';
  amount: number;
  currency: string;
  clientSecret?: string;
  provider: string;
}

export interface IPaymentProvider {
  createIntent(invoice: any, amount: number): Promise<PaymentIntent>;
  verifyPayment(intentId: string): Promise<boolean>;
  getProviderName(): string;
  isConfigured(): boolean;
}

export class SandboxPaymentProvider implements IPaymentProvider {
  async createIntent(invoice: any, amount: number): Promise<PaymentIntent> {
    return {
      id: 'SANDBOX_INTENT_' + Math.random().toString(36).substring(7).toUpperCase(),
      status: 'succeeded',
      amount,
      currency: invoice.currency,
      provider: 'sandbox'
    };
  }

  async verifyPayment(intentId: string): Promise<boolean> {
    return intentId.startsWith('SANDBOX_INTENT_');
  }

  getProviderName(): string {
    return 'Sandbox';
  }

  isConfigured(): boolean {
    return true; // Sandbox is always configured
  }
}

export class StripePaymentProvider implements IPaymentProvider {
  // Skeleton implementation for architecture requirement
  async createIntent(invoice: any, amount: number): Promise<PaymentIntent> {
    throw new Error('Stripe credentials not configured');
  }

  async verifyPayment(intentId: string): Promise<boolean> {
    return false;
  }

  getProviderName(): string {
    return 'Stripe';
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }
}
