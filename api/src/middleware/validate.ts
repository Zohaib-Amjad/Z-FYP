import type { RequestHandler } from 'express';
import { z, ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';
import type { ErrorDetail } from '../utils/response';
import { zodIssuesToDetails } from '../utils/zod';

interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const SOURCES = ['params', 'query', 'body'] as const;

const NOTHING_ALLOWED = z.object({}).strict();

export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    const details: ErrorDetail[] = [];
    for (const source of SOURCES) {
      const schema = schemas[source] ?? NOTHING_ALLOWED;
      const result = schema.safeParse(req[source]);
      if (result.success) {
        req[source] = result.data;
      } else {
        details.push(...zodIssuesToDetails(result.error));
      }
    }
    if (details.length > 0) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details));
      return;
    }
    next();
  };
