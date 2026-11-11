import type { RequestHandler } from 'express';
import morgan from 'morgan';
import { audit } from '../utils/audit';

/** Structured JSON request log: method, path without its query string, status, duration, user id. */
export const requestLogger = (
  stream: { write: (line: string) => void } = process.stdout,
): RequestHandler =>
  morgan(
    (tokens, req, res) =>
      JSON.stringify({
        level: 'info',
        type: 'request',
        time: new Date().toISOString(),
        method: req.method,
        path: (req.originalUrl ?? req.url ?? '').split('?')[0],
        status: Number(tokens.status(req, res)),
        durationMs: Number(tokens['response-time'](req, res)),
        userId: (req as { user?: { id: string } }).user?.id ?? null,
      }),
    { stream },
  );

/** Audit line for every successful state-changing call by a staff member: who changed what. */
export const auditStaffWrites: RequestHandler = (req, res, next) => {
  if (req.method === 'GET') {
    next();
    return;
  }
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    audit('staff.write', {
      actorId: req.user.id,
      method: req.method,
      route: `${req.baseUrl}${req.route?.path ?? ''}`,
      params: req.params,
      status: res.statusCode,
    });
  });
  next();
};
