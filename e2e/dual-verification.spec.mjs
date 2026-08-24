import { test, expect } from '@playwright/test'

const abcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const abcFile = {
  name: 'abc.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('abc')
}

async function verifyAbc(page) {
  await page.goto('/verify')
  await page.locator('#verify-file').setInputFiles(abcFile)
  await page.locator('#expected-hash').fill(abcHash)
  await page.locator('#verify-button').click()
  await expect(page.locator('#verify-result-title')).toHaveText('Verified locally')
  await expect(page.locator('#verify-result-copy')).toContainText('Two different local methods produced the same fingerprint')
  await expect(page.locator('#verify-result-copy')).toContainText('Nothing was uploaded')
  await expect(page.locator('#actual-hash')).toContainText(abcHash)
}

test('matching file is verified locally by both local methods without upload', async ({ page }) => {
  await page.goto('/verify')
  await page.locator('#verify-file').setInputFiles(abcFile)
  await page.locator('#expected-hash').fill(abcHash)

  const requestsDuringVerification = []
  page.on('request', (request) => requestsDuringVerification.push(request))
  await page.locator('#verify-button').click()

  await expect(page.locator('#verify-result-title')).toHaveText('Verified locally')
  await expect(page.locator('#verify-result-copy')).toContainText('Two different local methods produced the same fingerprint')
  await expect(page.locator('#verify-result-copy')).toContainText('Nothing was uploaded')
  await expect(page.locator('#actual-hash')).toContainText(abcHash)

  const pageOrigin = new URL(page.url()).origin
  for (const request of requestsDuringVerification) {
    expect(request.method()).toBe('GET')
    expect(new URL(request.url()).origin).toBe(pageOrigin)
    expect(request.postData()).toBeNull()
  }
})

test('browser verification reads the selected file exactly once', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'File prototype instrumentation is Chromium-only; cross-browser verification is covered separately.')

  await page.addInitScript(() => {
    window.__proofstampArrayBufferReads = 0
    const nativeArrayBuffer = Blob.prototype.arrayBuffer
    File.prototype.arrayBuffer = function arrayBuffer() {
      window.__proofstampArrayBufferReads += 1
      return nativeArrayBuffer.call(this)
    }
  })

  await verifyAbc(page)
  expect(await page.evaluate(() => window.__proofstampArrayBufferReads)).toBe(1)
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
