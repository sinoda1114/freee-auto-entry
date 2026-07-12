/** @type {import('@playwright/test').PlaywrightTestConfig} */
const PORT = process.env.E2E_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${PORT}`;

const config = {
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
};

if (process.env.E2E_SKIP_WEBSERVER !== "1") {
  config.webServer = {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      E2E_TEST_MODE: "1",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-test-auth-secret-32chars-min!!",
      NEXT_PUBLIC_SITE_URL: baseURL,
      FREEE_CLIENT_ID: "e2e-client-id",
      FREEE_CLIENT_SECRET: "e2e-client-secret",
      FREEE_REDIRECT_URI: `${baseURL}/api/auth/callback/freee`,
      GEMINI_API_KEY: "e2e-gemini-key",
      TURSO_DATABASE_URL: "file:.freee-e2e.db",
    },
  };
}

export default config;
