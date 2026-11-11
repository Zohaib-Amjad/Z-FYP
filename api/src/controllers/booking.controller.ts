import { createBooking } from '../services/booking.service';
import {
  cancelMyBooking,
  getMyBooking,
  getMyBookingCounts,
  listMyBookings,
} from '../services/myBooking.service';
import { getSlotPreview } from '../services/slotPreview.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { MyBookingsQuery } from '../validators/myBooking.validators';

export const create = asyncHandler(async (req, res) => {
  const booking = await createBooking(requireUser(req).id, req.body);
  ok(res, booking, 'Your test-drive request has been submitted', 201);
});

export const listMine = asyncHandler(async (req, res) => {
  ok(res, await listMyBookings(requireUser(req).id, validatedQuery<MyBookingsQuery>(req)));
});

export const counts = asyncHandler(async (req, res) => {
  ok(res, await getMyBookingCounts(requireUser(req).id));
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getMyBooking(requireUser(req).id, req.params.id));
});

export const cancel = asyncHandler(async (req, res) => {
  ok(
    res,
    await cancelMyBooking(requireUser(req).id, req.params.id, req.body),
    'Your booking has been cancelled',
  );
});

export const slotPreview = asyncHandler(async (req, res) => {
  ok(res, await getSlotPreview(req.params.id));
});
