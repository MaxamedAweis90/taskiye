import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { mongoClient, mongoDb } from '../db/connection.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerification,
} from './email.js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

import { ENV } from './env.js';

const isSmtpConfigured = Boolean(
  (process.env.SMTP_USER || process.env.GMAIL_USER) &&
  (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)
);

const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
    ? true
    : process.env.REQUIRE_EMAIL_VERIFICATION === 'false'
      ? false
      : isSmtpConfigured;

export const auth = betterAuth({
  database: mongodbAdapter(mongoDb, {
    client: mongoClient,
    transaction: false, // Prevents errors on standalone local MongoDB instances
  }),
  secret: ENV.BETTER_AUTH_SECRET,
  baseURL: ENV.BETTER_AUTH_URL,
  trustedOrigins: Array.from(
    new Set([
      'http://localhost:5173',
      'http://localhost:5000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5000',
      ...ENV.CLIENT_URL.split(',').map((u) => u.trim()).filter(Boolean),
      ENV.BETTER_AUTH_URL,
    ])
  ),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    async sendResetPassword({ user, url }) {
      if (user.email) {
        await sendPasswordResetEmail(user.email, url);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      if (user.email) {
        await sendVerificationEmail(user.email, url);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      async sendChangeEmailConfirmation({ newEmail, url }) {
        await sendEmailChangeVerification(newEmail, url);
      },
    },
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

