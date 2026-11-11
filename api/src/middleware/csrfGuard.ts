import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Origins allowed to change data. In development the API's own origin is also trusted (Swagger UI). */
const trustedOrigins = (): string[] => {
  const origins = [env.WEB_ORIGIN];
  if (env.NODE_ENV === 'development') {
    origins.push(`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`);
  }
  return origins;
};

const originOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return 'invalid';
  }
};

const hasBody = (headers: Record<string, string | string[] | undefined>): boolean =>
  Number(headers['content-length'] ?? 0) > 0 || headers['transfer-encoding'] !== undefined;

const isImageUpload = (method: string, path: string): boolean =>
  method === 'POST' && /^\/admin\/vehicles\/[^/]+\/images\/?$/.test(path);

/**
 * CSRF defence in depth, on top of the SameSite=Lax session cookie:
 *  1. A state-changing request that names an Origin (or, failing that, a Referer) must name a
 *     trusted one. Browsers always send Origin on cross-site POSTs, so forged requests are refused;
 *     tools such as curl or Postman, which send neither, are not affected.
 *  2. A request with a body must be JSON (multipart only for the image upload), which a plain HTML
 *     form cannot send.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const source = originOf(req.get('origin')) ?? originOf(req.get('referer'));
  if (source !== undefined && !trustedOrigins().includes(source)) {
    next(new AppError(403, 'FORBIDDEN', 'Requests from this origin are not allowed'));
    return;
  }
  if (hasBody(req.headers)) {
    const type = (req.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const allowed =
      type === 'application/json' ||
      (type === 'multipart/form-data' && isImageUpload(req.method, req.path));
    if (!allowed) {
      next(new AppError(415, 'VALIDATION_ERROR', 'Requests must be sent as JSON'));
      return;
    }
  }
  next();
};
