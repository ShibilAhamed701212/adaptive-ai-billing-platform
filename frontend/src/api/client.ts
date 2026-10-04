import { ApiResponse } from '@billing/shared';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

/** Fired when the session cookie is rejected; AuthContext listens and drops the user back to login. */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';
/** Fired (detail = message) when a GET fails from network loss, timeout or a 5xx; ToastProvider surfaces it. */
export const LOAD_FAILED_EVENT = 'api:load-failed';

const REQUEST_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Let the browser set the multipart boundary for FormData uploads.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  const isLoad = (options.method || 'GET').toUpperCase() === 'GET';

  // Without a timeout a hung server leaves pages on a loading spinner forever.
  const controller = new AbortController();
  const timer = options.signal ? undefined : setTimeout(() => controller.abort(), isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  let status = 0;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal ?? controller.signal,
    });
    status = res.status;

    // Proxies and crashed upstreams can return HTML/empty bodies; don't surface a JSON parse error.
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    if (!res.ok) {
      throw new Error(data.error?.message || data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? 'The server took too long to respond. Please try again.'
      : err?.message || 'Network request failed';
    if (isLoad && (status === 0 || status >= 500)) {
      window.dispatchEvent(new CustomEvent(LOAD_FAILED_EVENT, { detail: status === 0 && err?.name !== 'AbortError' ? 'Could not reach the server. Check your connection and try again.' : message }));
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message,
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const FETCH_ALL_PAGE_SIZE = 500;
const FETCH_ALL_MAX_PAGES = 20;

/**
 * GET every page of a paginated list endpoint (server default is 50 rows). Use for pickers and
 * pages that total or filter the full set client-side; non-paginated endpoints return after one call.
 */
export async function fetchAllPages<T = any>(endpoint: string): Promise<ApiResponse<T[]>> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const all: T[] = [];
  for (let page = 1; page <= FETCH_ALL_MAX_PAGES; page++) {
    const res = await apiRequest<T[]>(`${endpoint}${sep}page=${page}&limit=${FETCH_ALL_PAGE_SIZE}`);
    if (!res.success) return res;
    all.push(...(res.data || []));
    if (!(res as any).pagination?.hasMore) break;
  }
  return { success: true, data: all };
}
