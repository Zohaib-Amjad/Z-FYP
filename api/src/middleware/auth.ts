import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAuthToken } from '../utils/token';
import type { AuthUser } from '../types/auth';

const unauthenticated = (message = 'Please sign in to continue'): AppError =>
  new AppError(401, 'UNAUTHENTICATED', message);

const readTokenClaims = (token: unknown): AuthUser => {
  if (typeof token !== 'string' || token.length === 0) throw unauthenticated();
  try {
    return verifyAuthToken(token);
  } catch {
    throw unauthenticated('Your session is invalid or has expired');
  }
};

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const claims = readTokenClaims(req.cookies?.[env.COOKIE_NAME]);
  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, role: true, isActive: true },
  });
  if (!user) throw unauthenticated('Your session is invalid or has expired');
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
  }
  req.user = { id: user.id, role: user.role };
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthenticated());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
