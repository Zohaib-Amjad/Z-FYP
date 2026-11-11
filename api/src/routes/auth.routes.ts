import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { throttleLogins } from '../middleware/loginThrottle';
import { createAuthLimiter } from '../middleware/rateLimiters';
import { validate } from '../middleware/validate';
import { LoginThrottle } from '../utils/loginThrottle';
import { loginSchema, registerSchema } from '../validators/auth.validators';

export const createAuthRouter = (): Router => {
  const router = Router();
  const strictLimiter = createAuthLimiter();
  const throttle = new LoginThrottle();

  router.post('/register', strictLimiter, validate({ body: registerSchema }), register);
  router.post(
    '/login',
    strictLimiter,
    throttleLogins(throttle),
    validate({ body: loginSchema }),
    login,
  );
  router.post('/logout', validate({}), logout);
  router.get('/me', authenticate, validate({}), me);

  return router;
};
