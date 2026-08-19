import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'

const MOBILE_HEIGHT = 844
const photo = {
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-mobile-test-photo')
}

async function expectInViewport(locator) {
  await expect(locator).toBeVisible()
  await expect.poll(async () => {
    const box = await locator.boundingBox()
    return box ? box.y >= 0 && box.y < MOBILE_HEIGHT : false
  }).toBe(true)
}

async function expectFocused(page, locator) {
  await expect.poll(async () => locator.evaluate((element) => element === document.activeElement)).toBe(true)
  await expectInViewport(locator)
}

async function chooseAndHash(page) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(photo)
  await page.locator('#hash-file').click()
  await expect(page.locator('#details-stage')).toBeVisible()
  await expectFocused(page, page.locator('#description'))
}

async function completeRequiredFields(page) {
  await page.locator('#description').fill('Apartment condition before moving out')
  await page.locator('#primary-email').fill('person@example.com')
}

test.describe('mobile validation and stage navigation', () => {
  test('uses the 390x844 mobile viewport', async ({ page }) => {
    await page.goto('/')
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: 390, height: 844 })
  })

  test('adds files one at a time without replacing earlier selections', async ({ page }) => {
    const secondPhoto = {
      name: 'photo-2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-mobile-test-photo-2')
    }

    await page.goto('/')
    await page.locator('#file-input').setInputFiles(photo)
    await expect(page.locator('#selected-files .selected-file')).toHaveCount(1)
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')
    await expect(page.locator('#add-more-files')).toBeVisible()

    await page.locator('#file-input').setInputFiles(secondPhoto)
    await expect(page.locator('#selected-files .selected-file')).toHaveCount(2)
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')
    await expect(page.locator('#selected-files')).toContainText('photo-2.jpg')
    await expect(page.locator('#hash-file')).toHaveText('Create 2 file fingerprints')
  })

  test('adds verifier files one at a time without replacing earlier selections', async ({ page }) => {
    const secondPhoto = {
      name: 'verify-2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-verify-photo-2')
    }

    await page.goto('/verify')
    await page.locator('#verify-file').setInputFiles(photo)
    await expect(page.locator('#verify-selected-files .selected-file')).toHaveCount(1)
    await expect(page.locator('#add-more-verify-files')).toBeVisible()

    await page.locator('#verify-file').setInputFiles(secondPhoto)
    await expect(page.locator('#verify-selected-files .selected-file')).toHaveCount(2)
    await expect(page.locator('#verify-selected-files')).toContainText('photo.jpg')
    await expect(page.locator('#verify-selected-files')).toContainText('verify-2.jpg')
  })

  test('empty description moves focus and viewport to the description field', async ({ page }) => {
    await chooseAndHash(page)
    await page.locator('#primary-email').fill('person@example.com')
    await page.locator('button[type="submit"]').click()

    const field = page.locator('#description')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#description-error')).toContainText('Add a short description')
    await expectFocused(page, field)
  })

  test('invalid primary email moves focus and viewport to the email field', async ({ page }) => {
    await chooseAndHash(page)
    await page.locator('#description').fill('Move-out photos')
    await page.locator('#primary-email').fill('not-an-email')
    await page.locator('button[type="submit"]').click()

    const field = page.locator('#primary-email')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#primary-email-error')).toHaveText('Enter a valid email address.')
    await expectFocused(page, field)
  })

  test('keeps the optional second email hidden until requested and validates it in place', async ({ page }) => {
    await chooseAndHash(page)
    await completeRequiredFields(page)

    const cc = page.locator('#second-email')
    await expect(page.locator('#second-email-field')).toBeHidden()
    await expect(page.locator('#add-second-email')).toBeVisible()
    await page.locator('#add-second-email').click()
    await expect(page.locator('#second-email-field')).toBeVisible()
    await expectFocused(page, cc)

    await cc.fill('bad-cc')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#second-email-error')).toContainText('valid second email')
    await expectFocused(page, cc)

    await cc.fill('person@example.com')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#second-email-error')).toHaveText('Use a different address for the second email.')
    await expectFocused(page, cc)

    await page.locator('#remove-second-email').click()
    await expect(page.locator('#second-email-field')).toBeHidden()
    await expect(cc).toHaveValue('')
    await expectFocused(page, page.locator('#add-second-email'))
  })

  test('moves from hashing to context, then to the ready state, then back to step 1', async ({ page }) => {
    await chooseAndHash(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()

    const readyTitle = page.locator('#receipt-stage-title')
    await expect(page.locator('#receipt-stage')).toBeVisible()
    await expectFocused(page, readyTitle)

    await page.locator('#create-another').click()
    const stepOneTitle = page.locator('#file-stage-title')
    await expect(page.locator('#file-stage')).toBeVisible()
    await expectFocused(page, stepOneTitle)
  })

  test('rejects more than five files without losing the previous valid selection', async ({ page }) => {
    await page.goto('/')
    await page.locator('#file-input').setInputFiles(photo)
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')

    const tooMany = Array.from({ length: 6 }, (_, index) => ({
      name: `photo-${index + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(`photo-${index + 1}`)
    }))
    await page.locator('#file-input').setInputFiles(tooMany)

    const alert = page.locator('#create-alert')
    await expect(alert).toContainText('Choose up to 5 files at a time.')
    await expect(alert).toContainText('Your previous 1 file is still selected.')
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')
    await expectInViewport(alert)
  })

  test('/verify opens directly at the verifier on mobile', async ({ page }) => {
    await page.goto('/verify')

    await expect(page.locator('#verify-panel')).toBeVisible()
    await expect(page.locator('#verify-tab')).toHaveAttribute('aria-selected', 'true')
    await expectFocused(page, page.locator('.verify-intro h2'))
  })

  test('invalid verification text moves focus to the ProofStamp field', async ({ page }) => {
    await page.goto('/verify')
    await page.locator('#verify-file').setInputFiles(photo)
    await page.locator('#expected-hash').fill('not a fingerprint')
    await page.locator('#verify-button').click()

    const field = page.locator('#expected-hash')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#expected-hash-error')).toContainText('Paste a valid fingerprint')
    await expectFocused(page, field)
  })

  test('successful verification moves the result into view', async ({ page }) => {
    const fingerprint = createHash('sha256').update(photo.buffer).digest('hex')
    await page.goto('/verify')
    await page.locator('#verify-file').setInputFiles(photo)
    await page.locator('#expected-hash').fill(fingerprint)
    await page.locator('#verify-button').click()

    const result = page.locator('#verify-result')
    await expect(result).toHaveClass(/match/)
    await expect(page.locator('#verify-result-title')).toHaveText('This file matches the ProofStamp')
    await expectInViewport(result)
  })

  test('clipboard failure shows a visible toast instead of an off-screen alert', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('blocked') } }
      })
    })

    await chooseAndHash(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()
    await page.locator('#copy-receipt').click()

    const toast = page.locator('[data-proofstamp-toast]')
    await expect(toast).toContainText('Copying was blocked')
    await expectInViewport(toast)
  })

  test('usage metrics contain only aggregate event data', async ({ page }) => {
    const metrics = []
    await page.route('**/api/metrics', async (route) => {
      metrics.push(JSON.parse(route.request().postData() || '{}'))
      await route.fulfill({ status: 204, body: '' })
    })

    await chooseAndHash(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()

    await expect.poll(() => metrics.some((metric) => metric.event === 'proof_created')).toBe(true)
    const createdMetric = metrics.find((metric) => metric.event === 'proof_created')
    expect(createdMetric).toEqual(expect.objectContaining({ event: 'proof_created', fileCount: 1 }))
    expect(createdMetric.eventId).toEqual(expect.any(String))

    await page.evaluate(async () => {
      const { createMailtoUrl } = await import('/receipt.js')
      const receipt = {
        description: 'Private description',
        files: [{
          hash: 'a'.repeat(64),
          file_name: 'private-photo.jpg',
          file_size_bytes: 123,
          media_type: 'image/jpeg'
        }],
        created_at_device: '2026-08-19T18:00:00.000Z',
        verification_url: 'https://email.proofstamp.org/verify'
      }
      createMailtoUrl({ receipt, primaryEmail: 'private@example.com' })
      createMailtoUrl({ receipt, primaryEmail: 'private@example.com' })
    })

    await expect.poll(() => metrics.filter((metric) => metric.event === 'email_opened').length).toBe(1)
    const serialized = JSON.stringify(metrics)
    expect(serialized).not.toContain('private-photo.jpg')
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('Private description')
    expect(serialized).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })
})