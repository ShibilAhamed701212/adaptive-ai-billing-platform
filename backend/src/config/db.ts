import mongoose from 'mongoose';
import { ENV, IS_PRODUCTION, redactUri } from './env';
import { autoSeedIfEmpty } from '../seed';

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * POS checkout, payments, purchases, returns and restores use multi-document transactions, which
 * only replica sets / sharded clusters support. Fail at startup instead of on every sale.
 */
async function assertSupportsTransactions(): Promise<void> {
  const hello: any = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    const message = 'MongoDB is a standalone server; transactions (sales, payments, returns) need a replica set such as MongoDB Atlas';
    if (IS_PRODUCTION) throw new Error(message);
    console.warn(`⚠️ [Database] ${message}.`);
  }
}

export async function connectDB(): Promise<void> {
  // Prevent Mongoose from buffering queries indefinitely when disconnected
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', async () => {
    console.log(`✅ [Database] MongoDB connected (host: ${mongoose.connection.host})`);
    // Demo tenants have published passwords, so they are never created in production.
    if (!IS_PRODUCTION) await autoSeedIfEmpty();
  });

  mongoose.connection.on('error', (err) => {
    console.warn(`⚠️ [Database] MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [Database] MongoDB disconnected.');
  });

  try {
    await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    await assertSupportsTransactions();
  } catch (error: any) {
    console.error(`❌ [Database] Could not connect to MongoDB at ${redactUri(ENV.MONGODB_URI)}: ${error.message}`);
    if (IS_PRODUCTION) {
      // Never fall back to a throwaway database in production: customer data written there
      // would vanish on the next restart. Fail loudly so the platform keeps the last healthy deploy.
      throw error;
    }
    console.log('🔄 [Database] Development: falling back to an in-memory MongoDB with demo data...');
    // Single-node replica set: POS checkout, payments and restores use multi-document
    // transactions, which a standalone mongod rejects.
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    console.log('✅ [Database] Connected to in-memory MongoDB (data is lost on restart)');
  }
}
