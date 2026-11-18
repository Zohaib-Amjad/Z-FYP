import { Router } from 'express';
import {
  activate,
  create,
  deactivate,
  getAdmin,
  listAdmin,
  removeImage,
  update,
  uploadImage as uploadImageController,
} from '../controllers/dealership.controller';
import { uploadImage } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import {
  adminDealershipQuerySchema,
  createDealershipSchema,
  updateDealershipSchema,
  uploadDealershipImageBodySchema,
} from '../validators/dealership.validators';

const router = Router();
const withId = validate({ params: idParamsSchema });

router.get('/', validate({ query: adminDealershipQuerySchema }), listAdmin);
router.post('/', validate({ body: createDealershipSchema }), create);
router.get('/:id', withId, getAdmin);
router.patch('/:id', validate({ params: idParamsSchema, body: updateDealershipSchema }), update);
router.patch('/:id/deactivate', withId, deactivate);
router.patch('/:id/activate', withId, activate);
router.post(
  '/:id/image',
  withId,
  uploadImage,
  validate({ params: idParamsSchema, body: uploadDealershipImageBodySchema }),
  uploadImageController,
);
router.delete('/:id/image', withId, removeImage);

export default router;
