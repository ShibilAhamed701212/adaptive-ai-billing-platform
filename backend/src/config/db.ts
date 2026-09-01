import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(ENV.MONGODB_URI);
    console.log(`✅ [Database] MongoDB connected successfully to ${ENV.MONGODB_URI}`);
  } catch (error) {
    console.error('❌ [Database] Connection error:', error);
    // Don't kill process immediately in dev mode to allow graceful mock fallback if offline
    if (ENV.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}
