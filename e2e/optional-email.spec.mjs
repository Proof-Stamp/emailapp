import { test, expect } from '@playwright/test'

const photo = {
  name: 'local-only.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-local-only-photo')
}

test('creates a ProofStamp without requiring an email address', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await expect(page.locator('#details-stage')).toBeVisible()
  await page.locator('#description').fill('Local-only ProofStamp')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('#receipt-stage')).toBeVisible()
  await expect(page.locator('#receipt-provider-count')).toHaveText('Saved locally')
  await expect(page.locator('#receipt-summary')).not.toContainText('To')
  await expect(page.locator('#download-receipt')).toBeVisible()
  await expect(page.locator('#copy-receipt')).toBeVisible()
  await expect(page.locator('.attach-note')).toBeVisible()
})

test('email action still works without a prefilled recipient', async ({ page }) => {
  await page.addInitScript(() => {
    window.__proofstampOpenCalls = []
    window.open = (url, target, features) => {
      window.__proofstampOpenCalls.push({ url, target, features })
      return { closed: false }
    }
  })

  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await expect(page.locator('#details-stage')).toBeVisible()
  await page.locator('#description').fill('Email later')
  await page.locator('button[type="submit"]').click()
  await page.locator('#open-email').click()

  const openCalls = await page.evaluate(() => window.__proofstampOpenCalls)
  expect(openCalls).toHaveLength(1)
  expect(openCalls[0].url).toMatch(/^mailto:\?subject=/)
})
