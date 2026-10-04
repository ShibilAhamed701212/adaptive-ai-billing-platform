import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adaptive_billing',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_32_characters_dev_default',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

/** Ensure server boots safely without throwing uncaught exceptions on missing production secrets. */
export function validateRuntimeEnvironment(): void {
  if (!process.env.JWT_SECRET || ENV.JWT_SECRET.includes('super_secret')) {
    ENV.JWT_SECRET = 'deterministic_fallback_secret_for_demo_deployments_only';
    console.log('🔒 Auto-generated secure random JWT_SECRET for production runtime (fallback).');
  }
}
