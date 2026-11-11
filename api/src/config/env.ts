import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { jwtSecretProblem } from './jwtSecret';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const optionalString = z.string().optional().or(z.literal(''));

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_TEST: optionalString,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  COOKIE_NAME: z.string().default('td_session'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  CANCELLATION_WINDOW_HOURS: z.coerce.number().positive().default(24),
  MAX_ACTIVE_BOOKINGS: z.coerce.number().int().positive().default(3),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    value => (value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: optionalString,
});

const exitWithMessage = (message: string): never => {
  console.error(`Invalid or missing environment variables:\n  - ${message}`);
  return process.exit(1);
};

const redirectToTestDatabase = (raw: NodeJS.ProcessEnv): void => {
  const testUrl = raw.DATABASE_URL_TEST;
  if (!testUrl) exitWithMessage('DATABASE_URL_TEST is required when NODE_ENV=test');
  if (testUrl === raw.DATABASE_URL)
    exitWithMessage('DATABASE_URL_TEST must differ from DATABASE_URL');
  raw.DATABASE_URL = testUrl;
};

if (process.env.NODE_ENV === 'test') {
  redirectToTestDatabase(process.env);
}

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const lines = parsedEnv.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
  exitWithMessage(lines.join('\n  - '));
}

export const env = envSchema.parse(process.env);

const secretProblem = jwtSecretProblem(env.JWT_SECRET, env.NODE_ENV);
if (secretProblem) exitWithMessage(secretProblem);
