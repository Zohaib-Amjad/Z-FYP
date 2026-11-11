import { Router } from 'express';
import { getPublic, listPublic } from '../controllers/dealership.controller';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import { publicDealershipQuerySchema } from '../validators/dealership.validators';

const router = Router();

router.get('/', validate({ query: publicDealershipQuerySchema }), listPublic);
router.get('/:id', validate({ params: idParamsSchema }), getPublic);

export default router;
