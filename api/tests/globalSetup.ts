import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DEFAULT_TEST_DATABASE_URL, TEST_UPLOAD_DIR } from './testEnv';

const apiRoot = path.resolve(__dirname, '..');
const removeTestUploads = (): void =>
  fs.rmSync(path.join(apiRoot, TEST_UPLOAD_DIR), { recursive: true, force: true });

export default function setup(): () => void {
  const databaseUrl = process.env.DATABASE_URL_TEST || DEFAULT_TEST_DATABASE_URL;
  if (databaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL_TEST must differ from DATABASE_URL; refusing to wipe the dev database',
    );
  }
  removeTestUploads();
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  return removeTestUploads;
}
