import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: 'webkit-verify',
      testMatch: '**/dual-verification.spec.mjs',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit'
      }
    }
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
})
