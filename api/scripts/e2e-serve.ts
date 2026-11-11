import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Starts the API for the end-to-end tests: points it at a dedicated database, rebuilds and seeds
 * that database from scratch, then runs the normal server. It never touches the development or
 * the unit-test database.
 */
const E2E_DATABASE_URL =
  process.env.DATABASE_URL_E2E ?? 'postgresql://postgres:postgres@localhost:5432/testdrive_e2e';
const E2E_PORT = process.env.E2E_API_PORT ?? '4100';
const E2E_WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3100';

process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.PORT = E2E_PORT;
process.env.WEB_ORIGIN = E2E_WEB_ORIGIN;
process.env.UPLOAD_DIR = 'uploads-e2e';
process.env.NODE_ENV = 'development';

const apiRoot = path.resolve(__dirname, '..');

console.log(`Resetting the end-to-end database (${E2E_DATABASE_URL.replace(/:[^:@]*@/, ':***@')})`);
const reset = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-generate'], {
  cwd: apiRoot,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});
if (reset.status !== 0) {
  console.error('Could not reset the end-to-end database.');
  process.exit(reset.status ?? 1);
}

void import('../src/server');
