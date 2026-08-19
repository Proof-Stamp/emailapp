import { test, expect } from '@playwright/test'

test.describe('usage stats page', () => {
  test('shows the three aggregate ProofStamp metrics with the stats layout applied', async ({ page }) => {
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

    await expect(page.locator('link[href="/stats.css"]')).toHaveCount(1)
    await expect(page.locator('head style')).toHaveCount(0)
    await expect(page.locator('#stats-title')).toHaveText('ProofStamp usage')
    await expect(page.locator('#stat-created')).toHaveText('1,284')
    await expect(page.locator('#stat-open-rate')).toHaveText('73%')
    await expect(page.locator('#stat-average-files')).toHaveText('2.4')
    await expect(page.locator('#stats-status')).toContainText('Live aggregate usage')
    await expect(page.locator('.stats-note')).toContainText('aggregate counters only')

    const layout = await page.locator('.stats-grid').evaluate((element) => {
      const main = document.querySelector('.stats-main').getBoundingClientRect()
      const card = document.querySelector('.stat-card')
      const gridStyle = getComputedStyle(element)
      const cardStyle = getComputedStyle(card)
      return {
        mainLeft: main.left,
        mainRight: innerWidth - main.right,
        gridDisplay: gridStyle.display,
        cardRadius: cardStyle.borderRadius,
        cardBackground: cardStyle.backgroundColor
      }
    })

    expect(layout.mainLeft).toBeGreaterThan(0)
    expect(layout.mainRight).toBeGreaterThan(0)
    expect(layout.gridDisplay).toBe('grid')
    expect(layout.cardRadius).not.toBe('0px')
    expect(layout.cardBackground).not.toBe('rgba(0, 0, 0, 0)')
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
