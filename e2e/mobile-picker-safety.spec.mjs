import { test, expect } from '@playwright/test'

const existingPhoto = {
  name: 'gallery-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-existing-gallery-photo')
}

async function chooseFreshCapture(page, { name = 'camera-capture.jpg', type = 'image/jpeg' } = {}) {
  await page.locator('#file-input').dispatchEvent('click')
  await page.evaluate(({ name, type }) => {
    const input = document.querySelector('#file-input')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['proofstamp-fresh-capture'], name, {
      type,
      lastModified: Date.now()
    }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, { name, type })
}

async function expectFocused(locator) {
  await expect.poll(() => locator.evaluate((element) => element === document.activeElement)).toBe(true)
}

test('mobile picker guidance keeps documents discoverable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#file-stage .picker-help')).toContainText('Photos & videos')
  await expect(page.locator('#file-stage .picker-help')).toContainText('Files, My Files, Documents, or Browse')
})

test('existing gallery media does not show the fresh-capture warning', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(existingPhoto)

  await expect(page.locator('#details-stage')).toBeVisible()
  await expect(page.locator('#captured-media-safety')).toBeHidden()
  await expectFocused(page.locator('#description'))
})

test('fresh camera or recorder media gets preservation focus before Description', async ({ page }) => {
  await page.goto('/')
  await chooseFreshCapture(page)

  const safety = page.locator('#captured-media-safety')
  const saveButton = page.locator('#save-selected-media')
  await expect(page.locator('#details-stage')).toBeVisible()
  await expect(safety).toBeVisible()
  await expect(safety).toContainText('New camera or recorder file')
  await expectFocused(saveButton)

  const downloadPromise = page.waitForEvent('download')
  await saveButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('camera-capture.jpg')

  await expect(safety).toContainText('Original copy save started ✓')
  await expect(saveButton).toBeHidden()
  await expect(page.locator('#save-media-status')).toContainText('Downloads or Files')
  await expectFocused(page.locator('#description'))
})

test('a newly selected document never triggers media-preservation UI', async ({ page }) => {
  await page.goto('/')
  await chooseFreshCapture(page, { name: 'contract.pdf', type: 'application/pdf' })

  await expect(page.locator('#details-stage')).toBeVisible()
  await expect(page.locator('#captured-media-safety')).toBeHidden()
  await expectFocused(page.locator('#description'))
})
