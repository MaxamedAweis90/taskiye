import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, phoneNumberClient } from 'better-auth/client/plugins';

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // In production on Vercel, always use the same domain (Vercel rewrites proxy /api to the backend)
    // This guarantees 1st-party cookies and avoids cross-site cookie blocking by Safari/Chrome
    return window.location.origin;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    emailOTPClient(),
    phoneNumberClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
