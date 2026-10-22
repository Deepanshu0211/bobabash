import {defineConfig, devices} from '@playwright/test';

// QA runs against an already running app (`npm run dev` or `npm start`) and the Supabase
// project in .env. Tests never change the event phase, publish, or invalidate anything.
try { process.loadEnvFile('.env'); } catch { /* env may come from the shell instead */ }
try { process.loadEnvFile('.env.local'); } catch { /* optional */ }

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: {timeout: 10_000},
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: process.env.QA_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome']
  }
});
