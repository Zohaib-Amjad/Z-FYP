import { Router } from 'express';
import { getProfile, patchPassword, patchProfile } from '../controllers/profile.controller';
import { authenticate } from '../middleware/auth';
import { createUserLimiter } from '../middleware/rateLimiters';
import { validate } from '../middleware/validate';
import { changePasswordSchema, updateProfileSchema } from '../validators/profile.validators';

export const createProfileRouter = (): Router => {
  const router = Router();
  const passwordLimiter = createUserLimiter();

  router.use(authenticate);
  router.get('/', validate({}), getProfile);
  router.patch('/', validate({ body: updateProfileSchema }), patchProfile);
  router.patch(
    '/password',
    passwordLimiter,
    validate({ body: changePasswordSchema }),
    patchPassword,
  );

  return router;
};
