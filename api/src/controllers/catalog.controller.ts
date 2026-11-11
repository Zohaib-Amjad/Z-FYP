import {
  getCatalogFilters,
  getCatalogVehicle,
  listCatalogVehicles,
} from '../services/catalog.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { CatalogQuery } from '../validators/catalog.validators';

export const list = asyncHandler(async (req, res) => {
  ok(res, await listCatalogVehicles(validatedQuery<CatalogQuery>(req)));
});

export const filters = asyncHandler(async (_req, res) => {
  ok(res, await getCatalogFilters());
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getCatalogVehicle(req.params.id));
});
