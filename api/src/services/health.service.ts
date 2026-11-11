import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';

export interface HealthReport {
  status: 'ok';
  database: 'up';
}

export const getHealthReport = async (): Promise<HealthReport> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Health check: database unreachable', error);
    throw new AppError(503, 'INTERNAL_ERROR', 'The database is currently unavailable');
  }
  return { status: 'ok', database: 'up' };
};
