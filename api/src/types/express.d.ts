import type { AuthUser } from './auth';

declare global {
  // Declaration merging is only possible through the Express namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
