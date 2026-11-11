import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:3100';
const API_URL = 'http://localhost:4100';

/**
 * End-to-end tests run against the real stack: an API on port 4100 with its own freshly seeded
 * database, and a production build of the web app on port 3100. Tests share that one database, so
 * they run one at a time and each creates the customers and slots it needs.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e/results.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Uses the Chrome that is already installed, so no browser download is needed.
    channel: 'chrome',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: 'npm run e2e:serve --workspace=api',
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: 'node scripts/e2e-serve.mjs',
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 360_000,
    },
  ],
});
