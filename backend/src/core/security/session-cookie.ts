import { Response } from 'express';
import { ENV } from '../../config/env';

export function setSessionCookie(res: Response, token: string): void {
  // Controller unit tests use a minimal response double; production responses
  // always implement append().
  if (typeof (res as any).append !== 'function') return;
  const isProd = ENV.NODE_ENV === 'production';
  // In production with cross-origin frontend/backend, SameSite=None + Secure is
  // required for browsers to send cookies on cross-origin fetch requests.
  const sameSite = isProd ? 'None' : 'Lax';
  const secure = isProd ? '; Secure' : '';
  res.append('Set-Cookie', `billing_session=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/api/v1; Max-Age=604800${secure}`);
}

export function clearSessionCookie(res: Response): void {
  if (typeof (res as any).append !== 'function') return;
  const isProd = ENV.NODE_ENV === 'production';
  const sameSite = isProd ? 'None' : 'Lax';
  const secure = isProd ? '; Secure' : '';
  res.append('Set-Cookie', `billing_session=; HttpOnly; SameSite=${sameSite}; Path=/api/v1; Max-Age=0${secure}`);
}
