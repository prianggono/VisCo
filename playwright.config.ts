import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /ui-smoke\.test\.ts$/,
  timeout: 30000,
  use: { headless: true, viewport: { width: 1920, height: 1080 } },
  webServer: { command: "npm run preview -- --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 120000 }
});
