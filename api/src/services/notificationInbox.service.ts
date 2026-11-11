import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { NotificationsQuery } from '../validators/notification.validators';
import { AppError } from '../utils/AppError';
import { buildPage, toSkipTake } from '../utils/pagination';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  bookingId: true,
} satisfies Prisma.NotificationSelect;

export const listNotifications = async (userId: string, query: NotificationsQuery) => {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly ? { isRead: false } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: NOTIFICATION_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.notification.count({ where }),
  ]);
  return buildPage(items, total, query);
};

export const countUnread = async (userId: string): Promise<{ count: number }> => ({
  count: await prisma.notification.count({ where: { userId, isRead: false } }),
});

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  if (count === 0) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  return prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
    select: NOTIFICATION_SELECT,
  });
};

export const markAllNotificationsRead = async (userId: string): Promise<{ updated: number }> => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: count };
};
