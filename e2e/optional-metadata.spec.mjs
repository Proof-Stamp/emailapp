import { test, expect } from '@playwright/test'

const photo = {
  name: 'optional-context.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-optional-description')
}

test('prepares a ProofStamp with no description and no email address', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await expect(page.locator('#details-stage')).toBeVisible()

  await expect(page.locator('#description')).toHaveValue('')
  await expect(page.locator('#primary-email')).toHaveValue('')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('#receipt-stage')).toBeVisible()
  await expect(page.locator('#receipt-summary')).toContainText('optional-context.jpg')
  await expect(page.locator('#receipt-summary')).not.toContainText('Description')
  await expect(page.locator('#receipt-provider-count')).toHaveText('Saved locally')
})
