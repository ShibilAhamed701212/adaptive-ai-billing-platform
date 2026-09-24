import { ApiResponse } from '@billing/shared';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await res.json();

    if (res.status === 401) {
      // If token expired, clear and redirect to login if on protected route
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        localStorage.removeItem('billing_auth_token');
        localStorage.removeItem('billing_user');
        localStorage.removeItem('billing_org');
        localStorage.removeItem('billing_memberships');
        window.location.href = '/login';
      }
    }

    if (!res.ok) {
      throw new Error(data.error?.message || data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed',
      },
    };
  }
}
