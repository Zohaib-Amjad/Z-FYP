import { getHealthReport } from '../services/health.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const getHealth = asyncHandler(async (_req, res) => {
  ok(res, await getHealthReport());
});
