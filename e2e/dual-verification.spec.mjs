import { test, expect } from '@playwright/test'

const abcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const abcFile = {
  name: 'abc.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('abc')
}

test('matching file is verified locally by both local checks', async ({ page }) => {
  await page.goto('/verify')
  await page.locator('#verify-file').setInputFiles(abcFile)
  await page.locator('#expected-hash').fill(abcHash)
  await page.locator('#verify-button').click()

  await expect(page.locator('#verify-result-title')).toHaveText('Verified locally')
  await expect(page.locator('#verify-result-copy')).toContainText('Two local checks agree')
  await expect(page.locator('#verify-result-copy')).toContainText('not uploaded')
  await expect(page.locator('#actual-hash')).toContainText(abcHash)
})

test('agreed local hash that differs from the ProofStamp stays a mismatch', async ({ page }) => {
  await page.goto('/verify')
  await page.locator('#verify-file').setInputFiles(abcFile)
  await page.locator('#expected-hash').fill('0'.repeat(64))
  await page.locator('#verify-button').click()

  await expect(page.locator('#verify-result-title')).toHaveText('0 of 1 files match')
  await expect(page.locator('#verify-result')).toHaveClass(/mismatch/)
  await expect(page.locator('#actual-hash')).toContainText(abcHash)
})
