import {
  activateVehicle,
  createVehicle,
  deactivateVehicle,
  getAdminVehicle,
  listAdminVehicles,
  updateVehicle,
} from '../services/vehicle.service';
import {
  listVehicleDealerships,
  replaceVehicleDealerships,
} from '../services/vehicleAvailability.service';
import {
  UploadedImage,
  addVehicleImages,
  deleteVehicleImage,
  updateVehicleImage,
} from '../services/vehicleImage.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { AdminVehicleQuery } from '../validators/vehicle.validators';

export const list = asyncHandler(async (req, res) => {
  ok(res, await listAdminVehicles(validatedQuery<AdminVehicleQuery>(req)));
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getAdminVehicle(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  ok(res, await createVehicle(req.body), 'Vehicle created', 201);
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await updateVehicle(req.params.id, req.body), 'Vehicle updated');
});

export const deactivate = asyncHandler(async (req, res) => {
  ok(res, await deactivateVehicle(req.params.id), 'Vehicle deactivated');
});

export const activate = asyncHandler(async (req, res) => {
  ok(res, await activateVehicle(req.params.id), 'Vehicle activated');
});

export const getDealerships = asyncHandler(async (req, res) => {
  ok(res, await listVehicleDealerships(req.params.id));
});

export const replaceDealerships = asyncHandler(async (req, res) => {
  ok(
    res,
    await replaceVehicleDealerships(req.params.id, req.body),
    'Dealership availability updated',
  );
});

export const uploadImages = asyncHandler(async (req, res) => {
  const files: UploadedImage[] = Array.isArray(req.files) ? req.files : [];
  ok(res, await addVehicleImages(req.params.id, files, req.body.altText), 'Images uploaded', 201);
});

export const patchImage = asyncHandler(async (req, res) => {
  ok(res, await updateVehicleImage(req.params.id, req.params.imageId, req.body), 'Image updated');
});

export const removeImage = asyncHandler(async (req, res) => {
  ok(res, await deleteVehicleImage(req.params.id, req.params.imageId), 'Image removed');
});
