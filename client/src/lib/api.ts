/**
 * Shared API Fetch Client
 * - Enforces credentials: 'include' for session cookies
 * - Automatically injects Idempotency-Key on mutations (POST/PUT/PATCH)
 * - Intercepts HTTP 429 Rate Limit responses and dispatches rate-limit event
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  // Automatically attach Idempotency-Key on mutating requests if not provided
  if (['POST', 'PUT', 'PATCH'].includes(method) && !headers.has('Idempotency-Key')) {
    const key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    headers.set('Idempotency-Key', key);
  }

  const options: RequestInit = {
    ...init,
    headers,
    credentials: init.credentials || 'include',
  };

  const response = await fetch(input, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 10;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('taskiye:rate-limit', {
          detail: { retryAfterSeconds: isNaN(seconds) ? 10 : seconds },
        })
      );
    }
  }

  return response;
}
