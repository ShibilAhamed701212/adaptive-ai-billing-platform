import mongoose from 'mongoose';
import { ENV } from '../config/env';
import { UserModel } from '../models/User.model';
import { MembershipModel } from '../models/Membership.model';

/**
 * Backfills a Membership for every legacy user that only has an organizationId.
 * Safe to run multiple times; existing (userId, organizationId) pairs are skipped.
 */
export async function backfillMemberships(): Promise<{ created: number; scanned: number }> {
  const users = await UserModel.find({}).select('_id organizationId role isActive').lean();
  let created = 0;

  for (const user of users) {
    if (!user.organizationId) continue;
    const existing = await MembershipModel.findOne({
      userId: user._id,
      organizationId: user.organizationId,
    });
    if (existing) continue;

    await MembershipModel.create({
      userId: user._id,
      organizationId: user.organizationId,
      role: (user as any).role || 'viewer',
      status: (user as any).isActive === false ? 'disabled' : 'active',
    });
    created += 1;
  }

  return { created, scanned: users.length };
}

async function run() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(ENV.MONGODB_URI);
  }
  const result = await backfillMemberships();
  console.log(`✅ Membership backfill complete. Scanned ${result.scanned} users, created ${result.created} memberships.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('❌ Membership backfill failed:', err);
    process.exit(1);
  });
}
