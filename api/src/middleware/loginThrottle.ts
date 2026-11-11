import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { LoginThrottle } from '../utils/loginThrottle';

const emailKey = (body: unknown): string => {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const describeWait = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minutes`;
};

/**
 * Locks an account's sign-in for an escalating delay after repeated failures.
 * It reads the outcome of the real login handler (401 = wrong credentials, 200 = success), so the
 * service stays unaware of it.
 */
export const throttleLogins =
  (throttle: LoginThrottle): RequestHandler =>
  (req, res, next) => {
    const key = emailKey(req.body);
    if (!key) {
      next();
      return;
    }
    const wait = throttle.remainingLockMs(key);
    if (wait > 0) {
      res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          `Too many failed sign-in attempts. Please try again in ${describeWait(wait)}.`,
        ),
      );
      return;
    }
    res.on('finish', () => {
      if (res.statusCode === 401) throttle.recordFailure(key);
      else if (res.statusCode === 200) throttle.recordSuccess(key);
    });
    next();
  };
