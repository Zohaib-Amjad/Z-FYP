import { Router } from 'express';
import { createStaff, listStaff } from '../controllers/staff.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { auditStaffWrites } from '../middleware/requestLog';
import { validate } from '../middleware/validate';
import { createStaffSchema } from '../validators/auth.validators';
import { paginationQuerySchema } from '../validators/common';

const router = Router();

router.use(authenticate, requireRole('STAFF'), auditStaffWrites);
router.post('/', validate({ body: createStaffSchema }), createStaff);
router.get('/', validate({ query: paginationQuerySchema }), listStaff);

export default router;
