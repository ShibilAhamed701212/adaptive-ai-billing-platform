import cron from 'node-cron';
import { processAllPendingRecurringInvoices } from './recurring-invoice.job';
import mongoose from 'mongoose';
import { OrganizationModel } from '../models/Organization.model';

export function startCronJobs() {
  console.log('⏳ [Scheduler] Initializing cron jobs...');

  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [Scheduler] Running daily recurring invoice processor...');
    try {
      // Find all organizations to process subscriptions for
      const orgs = await OrganizationModel.find({}).lean();
      
      for (const org of orgs) {
        console.log(`[Scheduler] Processing recurring profiles for Org: ${org._id}`);
        // The processAllPendingRecurringInvoices function expects an orgId 
        // to filter by, or can process all if we loop over them.
        const summary = await processAllPendingRecurringInvoices(String(org._id));
        console.log(`[Scheduler] Org ${org._id} Complete: ${summary.generatedCount} generated, ${summary.failedCount} failed.`);
      }
    } catch (err: any) {
      console.error('❌ [Scheduler] Error during recurring invoice processing:', err.message);
    }
  });

  console.log('✅ [Scheduler] Cron jobs started successfully.');
}
