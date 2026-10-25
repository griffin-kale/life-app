import { defineConfig } from '@playwright/test';

// Ende-zu-Ende-Tests: echter Browser (iPhone-Breite), echte Datenbank, Claude als Attrappe.
// Lokal: Postgres auf DATABASE_URL, dann `npm run build && npm run test:e2e`.
const PORT = 3100;
export const TEST_ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://lage:lage@127.0.0.1:5433/lage',
  SESSION_SECRET: 'test-session-secret-nur-fuer-tests-0123456789abcdef',
  SETUP_TOKEN: 'setup-test-token-1234567890abc',
  CAPTURE_TOKEN: 'capture-test-token-1234567890abc',
  ANTHROPIC_API_KEY: 'sk-test-nur-fuer-die-attrappe',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:4010',
  PUBLIC_ORIGIN: `http://localhost:${PORT}`,
  WHOOP_CLIENT_ID: 'test-client',
  WHOOP_CLIENT_SECRET: 'test-secret',
  WHOOP_BASE: 'http://127.0.0.1:4010',
  OFF_BASE: 'http://127.0.0.1:4010',
  LIFE_ZEITPLAN: 'aus',
  GITHUB_ISSUES_TOKEN: 'github-test-token',
  GITHUB_API: 'http://127.0.0.1:4010',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'node tests/e2e/mock-claude.mjs', port: 4010, reuseExistingServer: !process.env.CI },
    { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}/api/health`, reuseExistingServer: !process.env.CI, env: TEST_ENV, timeout: 60_000 },
  ],
});
