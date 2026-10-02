import dotenv from 'dotenv';
import path from 'path';

// Load root and server .env files
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: false });

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

// Validate critical secrets
const authSecret = process.env.BETTER_AUTH_SECRET;

if (IS_PRODUCTION) {
  if (!authSecret) {
    throw new Error(
      '[FATAL SECURITY ERROR] BETTER_AUTH_SECRET environment variable is missing. The server cannot start in production without a cryptographic secret.'
    );
  }
  if (authSecret.length < 32) {
    throw new Error(
      '[FATAL SECURITY ERROR] BETTER_AUTH_SECRET must be at least 32 characters long for production security.'
    );
  }
} else if (!authSecret) {
  console.warn(
    '[DEV WARNING] BETTER_AUTH_SECRET is not set. Generating a temporary volatile session secret for this local process.'
  );
}

// Development volatile fallback secret (never statically predictable)
const volatileDevSecret = `dev_volatile_secret_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const ENV = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV,
  IS_PRODUCTION,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskiye',
  BETTER_AUTH_SECRET: authSecret || volatileDevSecret,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CRON_SECRET: process.env.CRON_SECRET || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',
} as const;
