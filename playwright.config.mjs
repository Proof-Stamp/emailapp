import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node e2e/server.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
})
