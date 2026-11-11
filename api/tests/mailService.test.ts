import { afterEach, describe, expect, it, vi } from 'vitest';

interface MailEnv {
  NODE_ENV: 'test' | 'development';
  SMTP_HOST: string;
  SMTP_PORT?: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  MAIL_FROM: string;
}

const message = {
  to: 'amelia@example.test',
  subject: 'Test drive confirmed: Porsche 911',
  text: 'Dear Amelia,\n\nYour test drive is confirmed.',
  html: '<p>Dear Amelia,</p>',
};

const load = async (mailEnv: Partial<MailEnv>, sendMailMock?: ReturnType<typeof vi.fn>) => {
  vi.resetModules();
  vi.doMock('../src/config/env', () => ({
    env: {
      NODE_ENV: 'test',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      MAIL_FROM: '',
      ...mailEnv,
    },
  }));
  const createTransport = vi.fn().mockReturnValue({ sendMail: sendMailMock });
  vi.doMock('nodemailer', () => ({ default: { createTransport } }));
  const mail = await import('../src/services/mailService');
  const { deliverEmails } = await import('../src/services/notificationService');
  return { ...mail, deliverEmails, createTransport };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../src/config/env');
  vi.doUnmock('nodemailer');
  vi.resetModules();
});

describe('mail service', () => {
  it('does nothing and does not fail when SMTP is not configured', async () => {
    const { sendMail, deliverEmails, createTransport } = await load({});

    await expect(sendMail(message)).resolves.toBeUndefined();
    await expect(deliverEmails([{ email: message }])).resolves.toBeUndefined();
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('prints a readable preview to the console when SMTP is not configured', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendMail } = await load({ NODE_ENV: 'development' });
    await sendMail(message);

    expect(info).toHaveBeenCalledTimes(1);
    const preview = String(info.mock.calls[0][0]);
    expect(preview).toContain('EMAIL PREVIEW');
    expect(preview).toContain('To:      amelia@example.test');
    expect(preview).toContain('Subject: Test drive confirmed: Porsche 911');
    expect(preview).toContain('Your test drive is confirmed.');
    expect(preview).not.toContain('<p>');
  });

  it('sends through SMTP when configured, with both text and HTML, reusing one transport', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({});
    const { sendMail, createTransport } = await load(
      {
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: 465,
        SMTP_USER: 'mailer',
        SMTP_PASS: 'secret',
        MAIL_FROM: 'Prestige <hello@prestige.test>',
      },
      sendMailMock,
    );
    await sendMail(message);
    await sendMail(message);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.test',
        port: 465,
        secure: true,
        auth: { user: 'mailer', pass: 'secret' },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'Prestige <hello@prestige.test>',
      ...message,
    });
  });

  it('uses a default sender, port 587 and no authentication when none is configured', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({});
    const { sendMail, createTransport } = await load({ SMTP_HOST: 'localhost' }, sendMailMock);
    await sendMail(message);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false, auth: undefined }),
    );
    expect(sendMailMock.mock.calls[0][0].from).toContain('no-reply@prestige.test');
  });

  it('a failing transport makes sendMail throw, but delivery only logs it and carries on', async () => {
    const sendMailMock = vi.fn().mockRejectedValue(new Error('connection refused'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sendMail, deliverEmails } = await load(
      { SMTP_HOST: 'smtp.example.test' },
      sendMailMock,
    );

    await expect(sendMail(message)).rejects.toThrow('connection refused');
    await expect(
      deliverEmails([{ email: message }, { email: { ...message, to: 'oliver@example.test' } }]),
    ).resolves.toBeUndefined();
    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0][0])).toContain('amelia@example.test');
    expect(String(error.mock.calls[1][0])).toContain('oliver@example.test');
  });
});
