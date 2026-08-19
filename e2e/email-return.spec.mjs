import { test, expect } from '@playwright/test'

const photo = {
  name: 'return-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-email-return-photo')
}

async function createProofstamp(page, metrics = null, options = {}) {
  if (metrics) {
    await page.route('**/api/metrics', async (route) => {
      metrics.push(JSON.parse(route.request().postData() || '{}'))
      await route.fulfill({ status: 204, body: '' })
    })
  } else {
    await page.route('**/api/metrics', async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })
  }

  await page.goto('/')
  await page.locator('#file-input').setInputFiles(options.photo || photo)
  await page.locator('#hash-file').click()
  await page.locator('#description').fill(options.description || 'Apartment condition before moving out')
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
    await expect(page.locator('#email-feedback')).toContainText('Did ProofStamp work as expected?')

    await page.locator('#return-verify').click()
    await expect(page.locator('#verify-panel')).toBeVisible()
    await expect(page.locator('#expected-hash')).toHaveValue(/PROOFSTAMP/)
    await expect(page.locator('#expected-hash')).toHaveValue(/Apartment condition before moving out/)
    await expect(page.locator('#expected-hash')).toHaveValue(/return-photo\.jpg/)
  })

  test('desktop opens email separately and keeps feedback in the ProofStamp tab', async ({ page }) => {
    await page.addInitScript(() => {
      window.__proofstampOpenCalls = []
      window.open = (url, target, features) => {
        window.__proofstampOpenCalls.push({ url, target, features })
        return { closed: false }
      }
    })

    await createProofstamp(page)
    const proofstampUrl = page.url()

    await page.locator('#open-email').click()

    await expect(page).toHaveURL(proofstampUrl)
    const openCalls = await page.evaluate(() => window.__proofstampOpenCalls)
    expect(openCalls).toHaveLength(1)
    expect(openCalls[0].url).toMatch(/^mailto:/)
    expect(openCalls[0].target).toBe('_blank')
    expect(openCalls[0].features).toContain('noopener')

    await expect(page.locator('#email-status')).toContainText('Email opened separately')
    await expect(page.locator('#email-return')).toBeVisible()
    await expect(page.locator('#email-return > strong')).toHaveText('After sending the email')
    await expect(page.locator('#email-return > p')).toContainText('Come back to this tab')
    await expect(page.locator('.email-feedback-actions')).toBeVisible()
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('proofstamp.emailOpened.v1'))).toBe('1')
  })

  test('records one anonymous Not quite response without leaving stuck buttons', async ({ page }) => {
    const metrics = []
    await createProofstamp(page, metrics)
    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v1', '1'))
    await page.reload()

    await page.locator('#feedback-no').click()
    await expect.poll(() => metrics.filter((metric) => metric.event === 'feedback_no').length).toBe(1)
    const feedbackMetric = metrics.find((metric) => metric.event === 'feedback_no')
    expect(feedbackMetric?.event).toBe('feedback_no')
    expect(feedbackMetric).not.toHaveProperty('fileName')
    expect(feedbackMetric).not.toHaveProperty('hash')
    expect(feedbackMetric).not.toHaveProperty('email')

    await expect(page.locator('.email-feedback-actions')).toBeHidden()
    await expect(page.locator('#feedback-message')).toContainText('A short note would help us fix it')
    await expect(page.locator('#feedback-detail')).toBeVisible()
    await expect(page.locator('#feedback-detail')).toHaveAttribute('href', /mailto:info@proofstamp\.org\?subject=ProofStamp%20feedback/)

    await page.reload()
    await expect(page.locator('.email-feedback-actions')).toBeHidden()
    await expect(page.locator('#feedback-detail')).toBeVisible()
    expect(metrics.filter((metric) => metric.event === 'feedback_no')).toHaveLength(1)
  })

  test('a new ProofStamp gets a fresh feedback choice in the same mobile session', async ({ page }) => {
    const metrics = []
    await createProofstamp(page, metrics)
    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v1', '1'))
    await page.reload()
    await page.locator('#feedback-no').click()
    await expect(page.locator('.email-feedback-actions')).toBeHidden()

    await page.locator('#return-create').click()
    await expect(page.locator('#file-stage')).toBeVisible()

    const secondPhoto = {
      name: 'second-return-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-second-email-return-photo')
    }
    await page.locator('#file-input').setInputFiles(secondPhoto)
    await page.locator('#hash-file').click()
    await page.locator('#description').fill('Second ProofStamp in the same session')
    await page.locator('#primary-email').fill('person@example.com')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#receipt-stage')).toBeVisible()

    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v1', '1'))
    await page.reload()

    await expect(page.locator('.email-feedback-actions')).toBeVisible()
    await expect(page.locator('#feedback-yes')).toBeEnabled()
    await expect(page.locator('#feedback-no')).toBeEnabled()

    await page.locator('#feedback-yes').click()
    await expect.poll(() => metrics.filter((metric) => metric.event === 'feedback_yes').length).toBe(1)
    await expect(page.locator('.email-feedback-actions')).toBeHidden()
    await expect(page.locator('#feedback-message')).toContainText('Thanks. That helps.')
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
