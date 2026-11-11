import {
  activateDealership,
  createDealership,
  deactivateDealership,
  getAdminDealership,
  getPublicDealership,
  listAdminDealerships,
  listPublicDealerships,
  updateDealership,
} from '../services/dealership.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type {
  AdminDealershipQuery,
  PublicDealershipQuery,
} from '../validators/dealership.validators';

export const listPublic = asyncHandler(async (req, res) => {
  ok(res, await listPublicDealerships(validatedQuery<PublicDealershipQuery>(req)));
});

export const getPublic = asyncHandler(async (req, res) => {
  ok(res, await getPublicDealership(req.params.id));
});

export const listAdmin = asyncHandler(async (req, res) => {
  ok(res, await listAdminDealerships(validatedQuery<AdminDealershipQuery>(req)));
});

export const getAdmin = asyncHandler(async (req, res) => {
  ok(res, await getAdminDealership(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  ok(res, await createDealership(req.body), 'Dealership created', 201);
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await updateDealership(req.params.id, req.body), 'Dealership updated');
});

export const deactivate = asyncHandler(async (req, res) => {
  ok(res, await deactivateDealership(req.params.id), 'Dealership deactivated');
});

export const activate = asyncHandler(async (req, res) => {
  ok(res, await activateDealership(req.params.id), 'Dealership activated');
});
