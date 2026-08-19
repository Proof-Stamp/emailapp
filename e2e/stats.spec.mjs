import { test, expect } from '@playwright/test'

test.describe('usage stats page', () => {
  test('shows the three aggregate ProofStamp metrics', async ({ page }) => {
    await page.route('**/api/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proofstampsCreated: 1284,
          emailAppOpened: 937,
          emailOpenRatePct: 73,
          averageFilesPerProofstamp: 2.4,
          updatedAt: '2026-08-19T18:15:00.000Z'
        })
      })
    })

    await page.goto('/stats')

    await expect(page.locator('#stats-title')).toHaveText('ProofStamp usage')
    await expect(page.locator('#stat-created')).toHaveText('1,284')
    await expect(page.locator('#stat-open-rate')).toHaveText('73%')
    await expect(page.locator('#stat-average-files')).toHaveText('2.4')
    await expect(page.locator('#stats-status')).toContainText('Live aggregate usage')
    await expect(page.locator('.stats-note')).toContainText('aggregate counters only')
  })

  test('handles a deployment without the metrics database', async ({ page }) => {
    await page.route('**/api/metrics', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Metrics database is not configured.' })
      })
    })

    await page.goto('/stats')

    await expect(page.locator('#stat-created')).toHaveText('—')
    await expect(page.locator('#stat-open-rate')).toHaveText('—')
    await expect(page.locator('#stat-average-files')).toHaveText('—')
    await expect(page.locator('#stats-status')).toContainText('not configured for this deployment')
  })
})
