import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end: the real web app and the real API, on their own ports so
 * they never clash with a running dev setup, plus a fake Gemini server.
 * Short AI time limits keep the failure journeys fast.
 */
const PORTS = { web: 5174, api: 4100, gemini: 4900 };
const root = '..';

export default defineConfig({
  testDir: './tests',
  // One shared fake Gemini: run tests one after another.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTS.web}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'npx tsx fake-gemini/server.ts',
      url: `http://localhost:${PORTS.gemini}/__fake/health`,
      env: { FAKE_GEMINI_PORT: String(PORTS.gemini) },
      reuseExistingServer: false,
    },
    {
      command: 'npm -w @approvals/api run start',
      cwd: root,
      url: `http://localhost:${PORTS.api}/api/health`,
      env: {
        PORT: String(PORTS.api),
        WEB_ORIGIN: `http://localhost:${PORTS.web}`,
        // Never the real key or the real Google: everything goes to the fake.
        GOOGLE_API_KEY: 'e2e-fake-key',
        AI_BASE_URL: `http://localhost:${PORTS.gemini}`,
        AI_FIRST_TOKEN_TIMEOUT_MS: '2000',
        AI_IDLE_TIMEOUT_MS: '1000',
        AI_MIN_RETRY_WINDOW_MS: '500',
      },
      reuseExistingServer: false,
    },
    {
      command: `npm -w @approvals/web run dev -- --port ${PORTS.web} --strictPort`,
      cwd: root,
      url: `http://localhost:${PORTS.web}`,
      env: { VITE_API_URL: `http://localhost:${PORTS.api}` },
      reuseExistingServer: false,
    },
  ],
});
