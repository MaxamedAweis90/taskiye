import { createAuthClient } from 'better-auth/react';
import { useState, useEffect } from 'react';

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
});

const rawSignOut = authClient.signOut;

export const signOut: typeof authClient.signOut = async (options) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('taskiye_auth_session');
    } catch {
    }
  }
  return await rawSignOut(options);
};

export const { signIn, signUp } = authClient;

export function useSession() {
  const sessionResult = authClient.useSession();
  const [cachedSession, setCachedSession] = useState<typeof sessionResult.data>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('taskiye_auth_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (sessionResult.data?.user) {
      setCachedSession(sessionResult.data);
      try {
        localStorage.setItem('taskiye_auth_session', JSON.stringify(sessionResult.data));
      } catch {
      }
    }
  }, [sessionResult.data]);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const effectiveData = sessionResult.data || (isOffline ? cachedSession : null);

  return {
    ...sessionResult,
    data: effectiveData,
  };
}
