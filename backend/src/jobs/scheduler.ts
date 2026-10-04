import cron from 'node-cron';
import { processAllPendingRecurringInvoices } from './recurring-invoice.job';
import mongoose from 'mongoose';

export function startCronJobs() {
  console.log('⏳ [Scheduler] Initializing cron jobs...');

  const runRecurringInvoices = async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const summary = await processAllPendingRecurringInvoices();
      if (summary.generatedCount || summary.failedCount) {
        console.log(`⏰ [Scheduler] Recurring invoices: ${summary.generatedCount} generated, ${summary.failedCount} failed.`);
      }
    } catch (err: any) {
      console.error('❌ [Scheduler] Error during recurring invoice processing:', err.message);
    }
  };

  // Hourly (not just midnight) plus shortly after boot: hosts that sleep idle instances would
  // otherwise miss the run entirely. Each billing period is claimed atomically, so extra runs
  // never double-bill; missed periods catch up one per run.
  cron.schedule('5 * * * *', runRecurringInvoices);
  setTimeout(runRecurringInvoices, 60_000).unref();

  console.log('✅ [Scheduler] Cron jobs started successfully.');
}
