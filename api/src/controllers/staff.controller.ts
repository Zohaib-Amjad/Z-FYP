import { createStaffAccount, listStaffAccounts } from '../services/staff.service';
import { asyncHandler } from '../utils/asyncHandler';
import type { PageParams } from '../utils/pagination';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';

export const createStaff = asyncHandler(async (req, res) => {
  ok(res, await createStaffAccount(req.body), 'Staff account created', 201);
});

export const listStaff = asyncHandler(async (req, res) => {
  ok(res, await listStaffAccounts(validatedQuery<PageParams>(req)));
});
