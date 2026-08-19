import { test, expect } from '@playwright/test'

const photo = {
  name: 'return-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-email-return-photo')
}

async function createProofstamp(page) {
  await page.route('**/api/metrics', async (route) => {
    await route.fulfill({ status: 204, body: '' })
  })
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await page.locator('#hash-file').click()
  await page.locator('#description').fill('Apartment condition before moving out')
  await page.locator('#primary-email').fill('person@example.com')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('#receipt-stage')).toBeVisible()
}

test.describe('email app return flow', () => {
  test('keeps the ProofStamp across a return or reload', async ({ page }) => {
    await createProofstamp(page)

    await expect(page.locator('#open-email')).toHaveText('Open email app')
    await expect(page.locator('.success-intro')).toHaveText('Open your email app, send the ProofStamp, then come back here.')
    await expect.poll(() => page.evaluate(() => Boolean(sessionStorage.getItem('proofstamp.currentReceipt.v1')))).toBe(true)

    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v1', '1'))
    await page.reload()

    await expect(page.locator('#receipt-stage')).toBeVisible()
    await expect(page.locator('#receipt-summary')).toContainText('Apartment condition before moving out')
    await expect(page.locator('#receipt-summary')).toContainText('person@example.com')
    await expect(page.locator('#open-email')).toHaveText('Open email app again')
    await expect(page.locator('#email-status')).toContainText('Your ProofStamp will still be waiting')
    await expect(page.locator('#email-return')).toBeVisible()
    await expect(page.locator('#email-return')).toContainText('Back from your email app?')

    await page.locator('#return-verify').click()
    await expect(page.locator('#verify-panel')).toBeVisible()
    await expect(page.locator('#expected-hash')).toContainText('PROOFSTAMP')
    await expect(page.locator('#expected-hash')).toContainText('Apartment condition before moving out')
    await expect(page.locator('#expected-hash')).toContainText('return-photo.jpg')
  })

  test('does not double-count an email app open after reload', async ({ page }) => {
    const metrics = []
    await page.route('**/api/metrics', async (route) => {
      metrics.push(JSON.parse(route.request().postData() || '{}'))
      await route.fulfill({ status: 204, body: '' })
    })

    const openSameReceipt = () => page.evaluate(async () => {
      const { createMailtoUrl } = await import('/receipt.js')
      const receipt = {
        description: 'Return flow test',
        files: [{
          hash: 'b'.repeat(64),
          file_name: 'return.jpg',
          file_size_bytes: 123,
          media_type: 'image/jpeg'
        }],
        created_at_device: '2026-08-19T19:30:00.000Z',
        verification_url: 'https://email.proofstamp.org/verify'
      }
      createMailtoUrl({ receipt, primaryEmail: 'person@example.com' })
    })

    await page.goto('/')
    await openSameReceipt()
    await expect.poll(() => metrics.filter((metric) => metric.event === 'email_opened').length).toBe(1)

    await page.reload()
    await openSameReceipt()
    await page.waitForTimeout(100)
    expect(metrics.filter((metric) => metric.event === 'email_opened')).toHaveLength(1)
  })
})
