import {
  getBookingsTrend,
  getDashboardSummary,
  getTopVehicles,
} from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type {
  SummaryQuery,
  TopVehiclesQuery,
  TrendQuery,
} from '../validators/dashboard.validators';

export const summary = asyncHandler(async (req, res) => {
  ok(res, await getDashboardSummary(validatedQuery<SummaryQuery>(req)));
});

export const trend = asyncHandler(async (req, res) => {
  ok(res, await getBookingsTrend(validatedQuery<TrendQuery>(req)));
});

export const topVehicles = asyncHandler(async (req, res) => {
  ok(res, await getTopVehicles(validatedQuery<TopVehiclesQuery>(req)));
});
