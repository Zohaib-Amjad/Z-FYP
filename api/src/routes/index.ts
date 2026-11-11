import { Router } from 'express';
import { createAdminRouter } from './admin.routes';
import { createAuthRouter } from './auth.routes';
import bookingsRoutes from './bookings.routes';
import dealershipsRoutes from './dealerships.routes';
import healthRoutes from './health.routes';
import notificationsRoutes from './notifications.routes';
import { createProfileRouter } from './profile.routes';
import staffRoutes from './staff.routes';
import vehiclesRoutes from './vehicles.routes';

export const createApiRouter = (): Router => {
  const router = Router();
  router.use(healthRoutes);
  router.use('/auth', createAuthRouter());
  router.use('/bookings', bookingsRoutes);
  router.use('/dealerships', dealershipsRoutes);
  router.use('/notifications', notificationsRoutes);
  router.use('/profile', createProfileRouter());
  router.use('/staff', staffRoutes);
  router.use('/vehicles', vehiclesRoutes);
  router.use('/admin', createAdminRouter());
  return router;
};
