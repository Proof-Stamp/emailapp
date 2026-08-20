import { test, expect } from '@playwright/test'

const capturedPhoto = {
  name: 'camera-capture.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-captured-photo')
}

test('mobile picker guidance keeps documents discoverable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#file-stage .picker-help')).toContainText('Photos & videos')
  await expect(page.locator('#file-stage .picker-help')).toContainText('Files, My Files, Documents, or Browse')
})

test('selected mobile media offers an original-file save path', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(capturedPhoto)

  const safety = page.locator('#captured-media-safety')
  await expect(safety).toBeVisible()
  await expect(safety).toContainText('Camera, Video, or Recorder')

  const downloadPromise = page.waitForEvent('download')
  await page.locator('#save-selected-media').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('camera-capture.jpg')
  await expect(page.locator('#save-media-status')).toContainText('saving the original file')
})
