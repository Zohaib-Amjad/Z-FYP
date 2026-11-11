import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const DEFAULT_SENDER = 'Prestige Test Drive <no-reply@prestige.test>';
const SECURE_SMTP_PORT = 465;
const DEFAULT_SMTP_PORT = 587;
const RULE = '-'.repeat(72);

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? DEFAULT_SMTP_PORT,
    secure: env.SMTP_PORT === SECURE_SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
};

const formatPreview = (message: MailMessage): string =>
  [
    '',
    RULE,
    'EMAIL PREVIEW (SMTP is not configured, so nothing was sent)',
    RULE,
    `To:      ${message.to}`,
    `Subject: ${message.subject}`,
    '',
    message.text,
    RULE,
    '',
  ].join('\n');

export const sendMail = async (message: MailMessage): Promise<void> => {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV !== 'test') console.info(formatPreview(message));
    return;
  }
  await getTransporter().sendMail({ from: env.MAIL_FROM || DEFAULT_SENDER, ...message });
};
