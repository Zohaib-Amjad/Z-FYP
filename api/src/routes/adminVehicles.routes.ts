import { Router } from 'express';
import {
  activate,
  create,
  deactivate,
  detail,
  getDealerships,
  list,
  patchImage,
  removeImage,
  replaceDealerships,
  update,
  uploadImages as uploadImagesController,
} from '../controllers/adminVehicle.controller';
import { uploadImages } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import {
  adminVehicleQuerySchema,
  createVehicleSchema,
  replaceDealershipsSchema,
  updateImageSchema,
  updateVehicleSchema,
  uploadImagesBodySchema,
  vehicleImageParamsSchema,
} from '../validators/vehicle.validators';

const router = Router();
const withId = validate({ params: idParamsSchema });

router.get('/', validate({ query: adminVehicleQuerySchema }), list);
router.post('/', validate({ body: createVehicleSchema }), create);
router.get('/:id', withId, detail);
router.patch('/:id', validate({ params: idParamsSchema, body: updateVehicleSchema }), update);
router.patch('/:id/deactivate', withId, deactivate);
router.patch('/:id/activate', withId, activate);
router.get('/:id/dealerships', withId, getDealerships);
router.put(
  '/:id/dealerships',
  validate({ params: idParamsSchema, body: replaceDealershipsSchema }),
  replaceDealerships,
);
router.post(
  '/:id/images',
  withId,
  uploadImages,
  validate({ params: idParamsSchema, body: uploadImagesBodySchema }),
  uploadImagesController,
);
router.patch(
  '/:id/images/:imageId',
  validate({ params: vehicleImageParamsSchema, body: updateImageSchema }),
  patchImage,
);
router.delete('/:id/images/:imageId', validate({ params: vehicleImageParamsSchema }), removeImage);

export default router;
