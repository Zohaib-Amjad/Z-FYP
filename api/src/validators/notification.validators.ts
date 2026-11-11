import { z } from 'zod';
import { booleanParam, paginationQuerySchema } from './common';

export const notificationsQuerySchema = paginationQuerySchema
  .extend({ unreadOnly: booleanParam })
  .strict();

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
