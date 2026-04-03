const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.resolve(__dirname, '..', 'test') }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx serve . --listen 3000 --no-clipboard',
    cwd: path.resolve(__dirname, '..'),
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
