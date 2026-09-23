import mongoose from 'mongoose';
import { ENV } from './env';
import { autoSeedIfEmpty } from '../seed';

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDB(): Promise<void> {
  // Prevent Mongoose from buffering queries indefinitely when disconnected
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', async () => {
    console.log(`✅ [Database] MongoDB connected successfully to ${ENV.MONGODB_URI}`);
    await autoSeedIfEmpty();
  });

  mongoose.connection.on('error', (err) => {
    console.warn(`⚠️ [Database] MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [Database] MongoDB disconnected.');
  });

  try {
    await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
  } catch (error: any) {
    console.warn(`⚠️ [Database] Could not connect to MongoDB at ${ENV.MONGODB_URI}: ${error.message}`);
    console.log('🔄 [Database] Falling back to In-Memory MongoDB for demonstration deployment...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log(`✅ [Database] Connected to In-Memory MongoDB at ${mongoUri}`);
    } catch (memError: any) {
      console.error('❌ [Database] Failed to start In-Memory MongoDB:', memError.message);
    }
  }
}
