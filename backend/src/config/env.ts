import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const DEV_JWT_SECRET = 'super_secret_jwt_key_32_characters_dev_default';

export const ENV = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adaptive_billing',
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

export const IS_PRODUCTION = ENV.NODE_ENV === 'production';

/** Hide credentials when a connection string is logged. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]+@/, '//***:***@');
}

/** Problems that make a production configuration unsafe to run (empty when it is fine). */
export function productionConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const secret = env.JWT_SECRET || '';
  if (secret.length < 32 || /super_secret|replace_with|fallback|changeme/i.test(secret)) {
    problems.push(`JWT_SECRET must be a unique random value of at least 32 characters (generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`);
  }
  if (!env.MONGODB_URI) problems.push('MONGODB_URI must point at your production MongoDB database');
  if (!env.CLIENT_URL) problems.push('CLIENT_URL must list the frontend origin(s) allowed to call the API');
  return problems;
}

/**
 * Refuse to boot production with unsafe configuration. A known JWT secret lets anyone forge a
 * session for any user, and a missing database URI would otherwise point at localhost.
 */
export function validateRuntimeEnvironment(): void {
  const problems = IS_PRODUCTION ? productionConfigProblems(process.env) : [];
  if (problems.length > 0) {
    throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);
  }
  if (!IS_PRODUCTION && !process.env.JWT_SECRET) {
    // Per-process random secret: sessions reset on restart, but nothing guessable is ever accepted.
    ENV.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    console.log('🔒 [Auth] JWT_SECRET not set; using a random per-process secret for development.');
  }
}
