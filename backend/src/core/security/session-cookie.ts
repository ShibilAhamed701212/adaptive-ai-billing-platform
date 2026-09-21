import { Response } from 'express';
import { ENV } from '../../config/env';

export function setSessionCookie(res: Response, token: string): void {
  // Controller unit tests use a minimal response double; production responses
  // always implement append().
  if (typeof (res as any).append !== 'function') return;
  // Controller unit tests use a minimal response double; production responses
  // always implement append().
  if (typeof (res as any).append !== 'function') return;
  const secure = ENV.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `billing_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=604800${secure}`);
}

export function clearSessionCookie(res: Response): void {
  if (typeof (res as any).append !== 'function') return;
  if (typeof (res as any).append !== 'function') return;
  const secure = ENV.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `billing_session=; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=0${secure}`);
}
