import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { auditStaffWrites } from '../middleware/requestLog';
import adminBookingsRoutes from './adminBookings.routes';
import adminDashboardRoutes from './adminDashboard.routes';
import adminCustomersRoutes from './adminCustomers.routes';
import adminDealershipsRoutes from './adminDealerships.routes';
import adminSlotsRoutes from './adminSlots.routes';
import adminVehiclesRoutes from './adminVehicles.routes';

export const createAdminRouter = (): Router => {
  const router = Router();
  router.use(authenticate, requireRole('STAFF'), auditStaffWrites);
  router.use('/bookings', adminBookingsRoutes);
  router.use('/customers', adminCustomersRoutes);
  router.use('/dashboard', adminDashboardRoutes);
  router.use('/dealerships', adminDealershipsRoutes);
  router.use('/vehicles', adminVehiclesRoutes);
  router.use('/slots', adminSlotsRoutes);
  return router;
};
