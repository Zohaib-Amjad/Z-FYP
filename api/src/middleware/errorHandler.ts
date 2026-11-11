import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';
import { zodIssuesToDetails } from '../utils/zod';

interface HttpClientError {
  status: number;
  expose: boolean;
}

const isHttpClientError = (err: unknown): err is HttpClientError =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  'expose' in err &&
  typeof err.status === 'number' &&
  err.status >= 400 &&
  err.status < 500 &&
  err.expose === true;

const uniqueFields = (err: Prisma.PrismaClientKnownRequestError): string[] => {
  const target = err.meta?.target;
  return Array.isArray(target) ? target.map(String) : [];
};

const handlePrismaError = (
  err: Prisma.PrismaClientKnownRequestError,
  res: Response,
): Response | null => {
  switch (err.code) {
    case 'P2002':
      return sendError(
        res,
        'CONFLICT',
        'A record with these values already exists',
        409,
        uniqueFields(err).map(field => ({ field, message: 'Must be unique' })),
      );
    case 'P2025':
      return sendError(res, 'NOT_FOUND', 'The requested record was not found', 404);
    case 'P2003':
      return sendError(res, 'CONFLICT', 'The operation conflicts with a related record', 409);
    default:
      return null;
  }
};

export const notFoundHandler = (req: Request, res: Response): Response =>
  sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'Request validation failed',
      422,
      zodIssuesToDetails(err),
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const handled = handlePrismaError(err, res);
    if (handled) return handled;
  }
  if (isHttpClientError(err)) {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'The request body is malformed or too large',
      err.status,
    );
  }

  console.error('Unhandled server error:', err);
  return sendError(
    res,
    'INTERNAL_ERROR',
    'An unexpected error occurred. Please try again later.',
    500,
  );
};
