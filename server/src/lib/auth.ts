import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { emailOTP } from 'better-auth/plugins';
import { mongoClient, mongoDb } from '../db/connection.js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

export const auth = betterAuth({
  database: mongodbAdapter(mongoDb, {
    client: mongoClient,
    transaction: false, // Prevents errors on standalone local MongoDB instances
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'taskiye_dev_auth_secret_minimum_32_characters_long',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  trustedOrigins: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5000',
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // In production, integrate with SendGrid/Resend.
        console.log(`[BetterAuth OTP] (${type}) Sending OTP to ${email}: ${otp}`);
      },
    }),
  ],
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true,
      },
      avatarUrl: {
        type: 'string',
        required: false,
        defaultValue: '',
        input: true,
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
