import { getCustomerDetail, listCustomers, setCustomerStatus } from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { CustomerListQuery } from '../validators/customer.validators';

export const list = asyncHandler(async (req, res) => {
  ok(res, await listCustomers(validatedQuery<CustomerListQuery>(req)));
});

export const detail = asyncHandler(async (req, res) => {
  ok(res, await getCustomerDetail(req.params.id));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const result = await setCustomerStatus(req.params.id, req.body.isActive, requireUser(req).id);
  const message = result.customer.isActive
    ? 'Customer account is active'
    : `Customer account deactivated. ${result.cancelledBookings} upcoming booking(s) cancelled.`;
  ok(res, result, message);
});
