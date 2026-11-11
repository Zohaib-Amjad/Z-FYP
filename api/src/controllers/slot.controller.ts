import { getAvailableSlots } from '../services/slotAvailability.service';
import {
  activateSlot,
  createSlot,
  deactivateSlot,
  getAdminSlot,
  listAdminSlots,
  updateSlotTimes,
} from '../services/slot.service';
import { createBulkSlots, previewBulkSlots } from '../services/slotBulk.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { AdminSlotQuery, AvailableSlotsQuery } from '../validators/slot.validators';

export const available = asyncHandler(async (req, res) => {
  ok(res, await getAvailableSlots(req.params.vehicleId, validatedQuery<AvailableSlotsQuery>(req)));
});

export const list = asyncHandler(async (req, res) => {
  ok(res, await listAdminSlots(validatedQuery<AdminSlotQuery>(req)));
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getAdminSlot(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  ok(res, await createSlot(req.body, requireUser(req).id), 'Slot created', 201);
});

export const bulk = asyncHandler(async (req, res) => {
  const { dryRun } = validatedQuery<{ dryRun?: boolean }>(req);
  if (dryRun) {
    ok(res, await previewBulkSlots(req.body), 'Preview generated. No slots were created');
    return;
  }
  const result = await createBulkSlots(req.body, requireUser(req).id);
  ok(res, result, `${result.totals.slots} slot(s) created`, 201);
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await updateSlotTimes(req.params.id, req.body), 'Slot updated');
});

export const deactivate = asyncHandler(async (req, res) => {
  ok(res, await deactivateSlot(req.params.id), 'Slot deactivated');
});

export const activate = asyncHandler(async (req, res) => {
  ok(res, await activateSlot(req.params.id), 'Slot activated');
});
