import type { Request } from 'express';

export const validatedQuery = <T>(req: Request): T => req.query as unknown as T;
