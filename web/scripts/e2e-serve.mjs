import { spawn, spawnSync } from 'node:child_process';

/**
 * Builds and serves the web app for the end-to-end tests on its own port and build folder, talking
 * to the end-to-end API, so it never disturbs a running development server.
 */
const env = {
  ...process.env,
  API_URL: process.env.E2E_API_URL ?? 'http://localhost:4100',
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
};

const build = spawnSync('npx', ['next', 'build'], { env, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn('npx', ['next', 'start', '-p', '3100'], {
  env,
  stdio: 'inherit',
  shell: true,
});
server.on('exit', code => process.exit(code ?? 0));
process.on('SIGTERM', () => server.kill());
process.on('SIGINT', () => server.kill());
