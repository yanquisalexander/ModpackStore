import { API_ENDPOINT } from "@/consts";

interface FetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

/**
 * Enhanced fetch wrapper that automatically handles 401 errors by attempting to refresh tokens.
 * This function should be used for API requests that require authentication.
 * 
 * @param url - The URL to fetch (can be relative to API_ENDPOINT or absolute)
 * @param options - Standard fetch options plus skipAuthRefresh flag
 * @returns Promise<Response>
 * 
 * @example
 * ```typescript
 * // Make an authenticated request
 * const response = await fetchWithAuth('/social/friends', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */
export async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuthRefresh, ...fetchOptions } = options;

  // Make the initial request
  const fullUrl = url.startsWith('http') ? url : `${API_ENDPOINT}${url}`;

  // Get the current access token from store if available
  let currentToken: string | null = null;
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load(import.meta.env.PROD ? 'auth_store.json' : 'auth_store.dev.json');
    const tokens = await store.get<any>('auth_tokens');
    currentToken = tokens?.access_token || null;
  } catch (error) {
    console.warn('[fetchWithAuth] Could not load auth tokens:', error);
  }

  // Prepare headers with token if available
  const headers = new Headers(fetchOptions.headers);
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  let response = await fetch(fullUrl, {
    ...fetchOptions,
    headers
  });

  // If we get a 401 and haven't skipped auth refresh, try to refresh tokens and retry
  if (response.status === 401 && !skipAuthRefresh) {
    console.log('[fetchWithAuth] Received 401, attempting token refresh...');

    try {
      // Dynamically import invoke to avoid circular dependencies
      const { invoke } = await import('@tauri-apps/api/core');
      const { load } = await import('@tauri-apps/plugin-store');

      // Try to refresh the tokens
      const refreshed = await invoke<boolean>('refresh_tokens');

      if (refreshed) {
        console.log('[fetchWithAuth] Tokens refreshed, retrying request...');

        // Get the new access token
        const store = await load(import.meta.env.PROD ? 'auth_store.json' : 'auth_store.dev.json');
        const tokens = await store.get<any>('auth_tokens');

        console.log('[fetchWithAuth] New tokens:', tokens);

        if (tokens?.access_token) {
          // Update the Authorization header with the new token
          const newHeaders = new Headers(fetchOptions.headers);
          newHeaders.set('Authorization', `Bearer ${tokens.access_token}`);

          // Retry the request with the new token (and skip auth refresh to avoid infinite loop)
          response = await fetch(fullUrl, {
            ...fetchOptions,
            headers: newHeaders,
          });

          console.log('[fetchWithAuth] Retry completed with status:', response.status);
        }
      } else {
        console.warn('[fetchWithAuth] Token refresh failed');
      }
    } catch (error) {
      console.error('[fetchWithAuth] Error during token refresh:', error);
    }
  }

  return response;
}

/**
 * Typed version of fetchWithAuth that automatically parses JSON responses.
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise<T> - The parsed JSON response
 * 
 * @example
 * ```typescript
 * interface User { id: string; name: string; }
 * const user = await fetchJson<User>('/users/me', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}
