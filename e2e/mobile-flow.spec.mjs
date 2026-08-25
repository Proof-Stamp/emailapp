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

async function chooseAndReady(page, selected = photo) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(selected)
  await expect(page.locator('#details-stage')).toBeVisible()
  await expect(page.locator('#hash-status')).toContainText('ready')
  await expectFocused(page, page.locator('#description'))
}

async function completeRequiredFields(page) {
  await page.locator('#description').fill('Apartment condition before moving out')
  await page.locator('#primary-email').fill('person@example.com')
}

test.describe('Concept A mobile flow', () => {
  test('uses the 390x844 mobile viewport', async ({ page }) => {
    await page.goto('/')
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: 390, height: 844 })
  })

  test('starts with one file picker and keeps the privacy promise concise', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#hero-title')).toHaveText('Proof a photo or file by email.')
    await expect(page.locator('#camera-input')).toHaveCount(0)
    await expect(page.locator('#drop-zone')).toContainText('Choose photos or files')
    await expect(page.locator('#file-stage')).toContainText('Preview your selection')
    await expect(page.locator('#file-stage')).toContainText('Files stay on this device')
  })

  test('shows local image previews so the user can confirm selected photos', async ({ page }) => {
    const secondPhoto = {
      name: 'photo-2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-mobile-test-photo-2')
    }

    await page.goto('/')
    await page.locator('#file-input').setInputFiles([photo, secondPhoto])

    await expect(page.locator('#selected-files .preview-file')).toHaveCount(2)
    await expect(page.locator('#selected-files img.file-thumbnail')).toHaveCount(2)
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')
    await expect(page.locator('#selected-files')).toContainText('photo-2.jpg')
    await expect(page.locator('#selected-files img.file-thumbnail').first()).toHaveAttribute('src', /^blob:/)
  })

  test('automatically fingerprints a selected file without a separate hash button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#hash-file')).toHaveCount(0)
    await page.locator('#file-input').setInputFiles(photo)

    await expect(page.locator('#selected-files .selected-file')).toHaveCount(1)
    await expect(page.locator('#hash-status')).toHaveText('1 file ready ✓')
    await expect(page.locator('#details-stage')).toBeVisible()
    await expectFocused(page, page.locator('#description'))
  })

  test('adds files without replacing earlier selections', async ({ page }) => {
    const secondPhoto = {
      name: 'photo-2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-mobile-test-photo-2')
    }

    await chooseAndReady(page)
    await expect(page.locator('#add-more-files')).toBeVisible()
    await page.locator('#file-input').setInputFiles(secondPhoto)

    await expect(page.locator('#selected-files .selected-file')).toHaveCount(2)
    await expect(page.locator('#selected-files')).toContainText('photo.jpg')
    await expect(page.locator('#selected-files')).toContainText('photo-2.jpg')
    await expect(page.locator('#hash-status')).toHaveText('2 files ready ✓')
  })

  test('lets the user remove a mistaken photo from the preview grid', async ({ page }) => {
    const secondPhoto = {
      name: 'photo-2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-mobile-test-photo-2')
    }

    await page.goto('/')
    await page.locator('#file-input').setInputFiles([photo, secondPhoto])
    await expect(page.locator('#selected-files .preview-file')).toHaveCount(2)
    await page.getByRole('button', { name: 'Remove photo.jpg' }).click()

    await expect(page.locator('#selected-files .preview-file')).toHaveCount(1)
    await expect(page.locator('#selected-files')).not.toContainText('photo.jpg')
    await expect(page.locator('#selected-files')).toContainText('photo-2.jpg')
  })

  test('empty description is allowed and falls back to the filename', async ({ page }) => {
    await chooseAndReady(page)
    await page.locator('#primary-email').fill('person@example.com')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('#receipt-stage')).toBeVisible()
    await expect(page.locator('#description')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#description-error')).toHaveCount(0)
    await expect(page.locator('#receipt-summary')).not.toContainText('Description')
    await expect(page.locator('#receipt-summary')).toContainText('photo.jpg')
  })

  test('invalid primary email moves focus and viewport to the email field', async ({ page }) => {
    await chooseAndReady(page)
    await page.locator('#description').fill('Move-out photos')
    await page.locator('#primary-email').fill('not-an-email')
    await page.locator('button[type="submit"]').click()

    const field = page.locator('#primary-email')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#primary-email-error')).toHaveText('Enter a valid email address or leave it blank.')
    await expectFocused(page, field)
  })

  test('keeps the optional second recipient hidden until requested and validates it in place', async ({ page }) => {
    await chooseAndReady(page)
    await completeRequiredFields(page)

    const cc = page.locator('#second-email')
    await expect(page.locator('#second-email-field')).toBeHidden()
    await page.locator('#add-second-email').click()
    await expect(page.locator('#second-email-field')).toBeVisible()
    await expectFocused(page, cc)

    await cc.fill('bad-cc')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#second-email-error')).toContainText('valid second email')
    await expectFocused(page, cc)

    await cc.fill('person@example.com')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#second-email-error')).toHaveText('Use a different address for the second recipient.')
    await expectFocused(page, cc)
  })

  test('moves to ProofStamp ready and exposes email, copy, save, and attachment guidance', async ({ page }) => {
    await chooseAndReady(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()

    const readyTitle = page.locator('#receipt-stage-title')
    await expect(page.locator('#receipt-stage')).toBeVisible()
    await expect(readyTitle).toHaveText('ProofStamp ready')
    await expectFocused(page, readyTitle)
    await expect(page.locator('.success-intro')).toHaveText('Your ProofStamp is ready. Email it, save it, or copy it.')
    await expect(page.locator('#open-email')).toHaveText('Email ProofStamp')
    await expect(page.locator('#copy-receipt')).toHaveText('Copy ProofStamp')
    await expect(page.locator('#download-receipt')).toHaveText('Save ProofStamp')
    await expect(page.locator('.email-cta-note')).toHaveText('Your email app will open with it ready to send.')
    await expect(page.locator('.attach-note')).toContainText('Optional: attach the originals before sending.')
    await expect(page.locator('.attach-note')).toContainText('attach the original files in your email app')
    await expect(page.locator('.offline-note')).toContainText('No connection?')
    await expect(page.locator('#receipt-summary')).not.toContainText('Created at')
  })

  test('create and verify flows make no application API requests', async ({ page }) => {
    const apiRequests = []
    await page.route('**/api/**', async (route) => {
      apiRequests.push({ method: route.request().method(), url: route.request().url() })
      await route.fulfill({ status: 204, body: '' })
    })

    await chooseAndReady(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()
    await page.locator('#verify-tab').click()
    await page.locator('#verify-file').setInputFiles(photo)
    const fingerprint = createHash('sha256').update(photo.buffer).digest('hex')
    await page.locator('#expected-hash').fill(fingerprint)
    await page.locator('#verify-button').click()
    await expect(page.locator('#verify-result')).toHaveClass(/match/)

    expect(apiRequests).toEqual([])
  })

  test('rejects more than five files without losing the previous valid selection', async ({ page }) => {
    await chooseAndReady(page)

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

  test('successful verification moves the result into view', async ({ page }) => {
    const fingerprint = createHash('sha256').update(photo.buffer).digest('hex')
    await page.goto('/verify')
    await page.locator('#verify-file').setInputFiles(photo)
    await page.locator('#expected-hash').fill(fingerprint)
    await page.locator('#verify-button').click()

    const result = page.locator('#verify-result')
    await expect(result).toHaveClass(/match/)
    await expect(page.locator('#verify-result-title')).toHaveText('Verified locally')
    await expectInViewport(result)
  })

  test('clipboard failure shows a visible fallback', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('blocked') } }
      })
    })

    await chooseAndReady(page)
    await completeRequiredFields(page)
    await page.locator('button[type="submit"]').click()
    await page.locator('#copy-receipt').click()

    const toast = page.locator('[data-proofstamp-toast]')
    await expect(toast).toContainText('Use Save ProofStamp instead')
    await expectInViewport(toast)
  })

  test('primary mobile controls are at least 44 CSS pixels tall', async ({ page }) => {
    await page.goto('/')
    const picker = page.locator('#drop-zone')
    const pickerBox = await picker.boundingBox()
    expect(pickerBox?.height || 0).toBeGreaterThanOrEqual(44)

    await page.locator('#file-input').setInputFiles(photo)
    await expect(page.locator('#details-stage')).toBeVisible()
    for (const selector of ['#add-more-files', '.prepare-button']) {
      const box = await page.locator(selector).boundingBox()
      expect(box?.height || 0).toBeGreaterThanOrEqual(44)
    }

    const removeBox = await page.getByRole('button', { name: 'Remove photo.jpg' }).boundingBox()
    expect(removeBox?.height || 0).toBeGreaterThanOrEqual(44)
  })
})