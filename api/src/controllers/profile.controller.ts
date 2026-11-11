import { getCurrentUser } from '../services/auth.service';
import { changePassword, updateProfile } from '../services/profile.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';

export const getProfile = asyncHandler(async (req, res) => {
  ok(res, await getCurrentUser(requireUser(req).id));
});

export const patchProfile = asyncHandler(async (req, res) => {
  ok(res, await updateProfile(requireUser(req).id, req.body), 'Your profile has been updated');
});

export const patchPassword = asyncHandler(async (req, res) => {
  await changePassword(requireUser(req).id, req.body);
  ok(res, null, 'Your password has been updated');
});
