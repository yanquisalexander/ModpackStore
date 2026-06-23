import { API_ENDPOINT } from "@/consts";

interface FetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
  token?: string;
}

let cachedStoreTokens: { access_token: string } | null = null;
let storeLoadAttempted = false;

async function getStoredToken(): Promise<string | null> {
  if (cachedStoreTokens?.access_token) {
    return cachedStoreTokens.access_token;
  }

  if (!storeLoadAttempted) {
    storeLoadAttempted = true;
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load(import.meta.env.PROD ? 'auth_store.json' : 'auth_store.dev.json');
      const tokens = await store.get<{ access_token: string }>('auth_tokens');
      if (tokens?.access_token) {
        cachedStoreTokens = tokens;
        return tokens.access_token;
      }
    } catch (error) {
      console.warn('[fetchWithAuth] Could not load auth tokens:', error);
    }
  }

  return null;
}

export function invalidateCachedToken() {
  cachedStoreTokens = null;
  storeLoadAttempted = false;
}

export async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuthRefresh, token: callerToken, ...fetchOptions } = options;

  const fullUrl = url.startsWith('http') ? url : `${API_ENDPOINT}${url}`;

  const currentToken = callerToken || await getStoredToken();

  const headers = new Headers(fetchOptions.headers);
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  let response = await fetch(fullUrl, {
    ...fetchOptions,
    headers
  });

  if (response.status === 401 && !skipAuthRefresh) {
    console.log('[fetchWithAuth] Received 401, attempting token refresh...');

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const refreshed = await invoke<boolean>('refresh_tokens');

      if (refreshed) {
        invalidateCachedToken();
        const newToken = await getStoredToken();

        if (newToken) {
          const newHeaders = new Headers(fetchOptions.headers);
          newHeaders.set('Authorization', `Bearer ${newToken}`);

          response = await fetch(fullUrl, {
            ...fetchOptions,
            headers: newHeaders,
          });
        }
      }
    } catch (error) {
      console.error('[fetchWithAuth] Error during token refresh:', error);
    }
  }

  return response;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}
