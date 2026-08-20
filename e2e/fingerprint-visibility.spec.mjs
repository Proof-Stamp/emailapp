import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'

const photo = {
  name: 'driveway.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-visible-fingerprint-test')
}

test('ready screen shows the actual SHA-256 hash as the file fingerprint', async ({ page }) => {
  const expectedHash = createHash('sha256').update(photo.buffer).digest('hex')

  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await expect(page.locator('#details-stage')).toBeVisible()
  await page.locator('#description').fill('Driveway before repair')
  await page.locator('#primary-email').fill('person@example.com')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('#receipt-stage')).toBeVisible()
  await expect(page.locator('#receipt-summary')).toContainText('SHA-256 hash / file fingerprint')
  await expect(page.locator('#receipt-summary')).toContainText(expectedHash)
  await expect(page.locator('.hash-value-note')).toContainText("The SHA-256 hash is the file's unique fingerprint.")
})
