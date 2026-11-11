import type { Request } from 'express';
import type { AuthUser } from '../types/auth';
import { AppError } from './AppError';

export const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  return req.user;
};
