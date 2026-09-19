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

export const auth = betterAuth({
  database: mongodbAdapter(mongoDb, {
    client: mongoClient,
    transaction: false, // Prevents errors on standalone local MongoDB instances
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'taskiye_dev_auth_secret_minimum_32_characters_long',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5000',
    'https://taskiye.vercel.app',
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((u) => u.trim()) : []),
  ],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }: { user: { email: string }; url: string }) {
      await sendVerificationEmail(user.email, url);
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
      async sendChangeEmailVerification({ newEmail, url }: { newEmail: string; url: string }) {
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

