import { getAdminBooking, listAdminBookings } from '../services/adminBooking.service';
import {
  approveBooking,
  cancelBookingByStaff,
  completeBooking,
  rejectBooking,
  rescheduleBooking,
} from '../services/bookingAction.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { AdminBookingsQuery } from '../validators/adminBooking.validators';

export const list = asyncHandler(async (req, res) => {
  ok(res, await listAdminBookings(validatedQuery<AdminBookingsQuery>(req)));
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getAdminBooking(req.params.id));
});

export const approve = asyncHandler(async (req, res) => {
  ok(res, await approveBooking(req.params.id, requireUser(req).id, req.body), 'Booking approved');
});

export const reject = asyncHandler(async (req, res) => {
  ok(res, await rejectBooking(req.params.id, requireUser(req).id, req.body), 'Booking rejected');
});

export const reschedule = asyncHandler(async (req, res) => {
  ok(
    res,
    await rescheduleBooking(req.params.id, requireUser(req).id, req.body),
    'Booking rescheduled',
  );
});

export const cancel = asyncHandler(async (req, res) => {
  ok(
    res,
    await cancelBookingByStaff(req.params.id, requireUser(req).id, req.body),
    'Booking cancelled',
  );
});

export const complete = asyncHandler(async (req, res) => {
  ok(res, await completeBooking(req.params.id, requireUser(req).id, req.body), 'Booking completed');
});
