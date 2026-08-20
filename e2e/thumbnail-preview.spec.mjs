import { test, expect } from '@playwright/test'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl+sqAAAAAASUVORK5CYII=',
  'base64'
)

test('selected image preview actually renders instead of showing a broken image icon', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles({
    name: 'preview.png',
    mimeType: 'image/png',
    buffer: tinyPng
  })

  const image = page.locator('#selected-files img.file-thumbnail')
  await expect(image).toHaveAttribute('data-local-preview-ready', 'true')
  await expect(image).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect.poll(() => image.evaluate((element) => ({
    complete: element.complete,
    width: element.naturalWidth,
    height: element.naturalHeight,
    visibility: getComputedStyle(element).visibility
  }))).toEqual({ complete: true, width: 1, height: 1, visibility: 'visible' })
})
