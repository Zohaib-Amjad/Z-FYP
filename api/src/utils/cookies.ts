import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
});

const expiryOf = (token: string): Date | undefined => {
  const payload = jwt.decode(token);
  if (payload && typeof payload === 'object' && typeof payload.exp === 'number') {
    return new Date(payload.exp * 1000);
  }
  return undefined;
};

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(env.COOKIE_NAME, token, { ...baseOptions(), expires: expiryOf(token) });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(env.COOKIE_NAME, baseOptions());
};
