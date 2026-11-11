import { Router } from 'express';
import { summary, topVehicles, trend } from '../controllers/dashboard.controller';
import { validate } from '../middleware/validate';
import {
  summaryQuerySchema,
  topVehiclesQuerySchema,
  trendQuerySchema,
} from '../validators/dashboard.validators';

const router = Router();

router.get('/summary', validate({ query: summaryQuerySchema }), summary);
router.get('/bookings-trend', validate({ query: trendQuerySchema }), trend);
router.get('/top-vehicles', validate({ query: topVehiclesQuerySchema }), topVehicles);

export default router;
