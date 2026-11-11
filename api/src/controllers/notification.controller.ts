import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationInbox.service';
import { asyncHandler } from '../utils/asyncHandler';
import { requireUser } from '../utils/requestUser';
import { ok } from '../utils/response';
import { validatedQuery } from '../utils/validated';
import type { NotificationsQuery } from '../validators/notification.validators';

export const list = asyncHandler(async (req, res) => {
  ok(res, await listNotifications(requireUser(req).id, validatedQuery<NotificationsQuery>(req)));
});

export const unreadCount = asyncHandler(async (req, res) => {
  ok(res, await countUnread(requireUser(req).id));
});

export const markRead = asyncHandler(async (req, res) => {
  ok(res, await markNotificationRead(requireUser(req).id, req.params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  ok(res, await markAllNotificationsRead(requireUser(req).id), 'All notifications marked as read');
});
