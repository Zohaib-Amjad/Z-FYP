import { getCurrentUser, loginUser, registerCustomer } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { clearAuthCookie, setAuthCookie } from '../utils/cookies';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerCustomer(req.body);
  setAuthCookie(res, token);
  ok(res, user, 'Welcome to Prestige. Your account has been created.', 201);
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  setAuthCookie(res, token);
  ok(res, user, 'Signed in successfully');
});

export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  ok(res, null, 'Signed out successfully');
});

export const me = asyncHandler(async (req, res) => {
  ok(res, await getCurrentUser(requireUser(req).id));
});
