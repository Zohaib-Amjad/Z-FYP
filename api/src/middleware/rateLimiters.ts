import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import { sendError } from '../utils/response';

const WINDOW_MS = 15 * 60 * 1000;
const GENERAL_LIMIT = 300;
const AUTH_LIMIT = 10;

interface LimiterOptions {
  limit: number;
  windowMs?: number;
  keyGenerator?: (req: Request) => string;
}

const createRateLimiter = ({
  limit,
  windowMs = WINDOW_MS,
  keyGenerator,
}: LimiterOptions): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) => {
      sendError(res, 'RATE_LIMITED', 'Too many requests. Please try again later.', 429);
    },
  });

const emailFromBody = (req: Request): string => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

export const createGeneralLimiter = (limit = GENERAL_LIMIT): RateLimitRequestHandler =>
  createRateLimiter({ limit });

export const createUserLimiter = (limit = AUTH_LIMIT): RateLimitRequestHandler =>
  createRateLimiter({
    limit,
    keyGenerator: req => `${req.ip ?? 'unknown'}|${req.user?.id ?? ''}`,
  });

export const createAuthLimiter = (limit = AUTH_LIMIT): RateLimitRequestHandler =>
  createRateLimiter({
    limit,
    keyGenerator: req => `${req.ip ?? 'unknown'}|${emailFromBody(req)}`,
  });
