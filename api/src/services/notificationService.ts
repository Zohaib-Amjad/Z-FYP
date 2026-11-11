import type { NotificationType, Prisma } from '@prisma/client';
import { MailMessage, sendMail } from './mailService';
import { NotificationVars, buildNotificationContent } from './notificationTemplates';

export interface PendingNotification {
  email: MailMessage;
}

export const notify = async (
  tx: Prisma.TransactionClient,
  userId: string,
  bookingId: string,
  type: NotificationType,
  vars: NotificationVars,
): Promise<PendingNotification> => {
  const content = buildNotificationContent(type, vars);
  await tx.notification.create({
    data: { userId, bookingId, type, title: content.title, message: content.message },
  });
  return {
    email: {
      to: vars.booking.customer.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    },
  };
};

const attemptEmail = async (email: MailMessage): Promise<void> => {
  try {
    await sendMail(email);
  } catch (error) {
    console.error(
      `Email to ${email.to} could not be sent; the booking action is unaffected`,
      error,
    );
  }
};

export const deliverEmails = async (pending: PendingNotification[]): Promise<void> => {
  await Promise.all(pending.map(item => attemptEmail(item.email)));
};
