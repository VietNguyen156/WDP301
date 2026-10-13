import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5174",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ../BE/tests/e2e-server.js",
      url: "http://127.0.0.1:5001",
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://localhost:5174",
      timeout: 60000,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:5001" },
    },
  ],
});
