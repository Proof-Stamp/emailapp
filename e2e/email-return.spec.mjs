import { test, expect } from '@playwright/test'

const photo = {
  name: 'return-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('proofstamp-email-return-photo')
}

async function createProofstamp(page, options = {}) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(options.photo || photo)
  await expect(page.locator('#details-stage')).toBeVisible()
  await page.locator('#description').fill(options.description || 'Apartment condition before moving out')
  await page.locator('#primary-email').fill('person@example.com')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('#receipt-stage')).toBeVisible()
}

test.describe('email app return flow', () => {
  test('keeps the ProofStamp across a return or reload without a server', async ({ page }) => {
    const apiRequests = []
    await page.route('**/api/**', async (route) => {
      apiRequests.push(route.request().url())
      await route.fulfill({ status: 204, body: '' })
    })

    await createProofstamp(page)

    await expect(page.locator('#open-email')).toHaveText('Email ProofStamp')
    await expect(page.locator('.success-intro')).toHaveText('Your ProofStamp is ready. Email it, save it, or copy it.')
    await expect.poll(() => page.evaluate(() => Boolean(sessionStorage.getItem('proofstamp.currentReceipt.v2')))).toBe(true)

    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v2', '1'))
    await page.reload()

    await expect(page.locator('#receipt-stage')).toBeVisible()
    await expect(page.locator('#receipt-summary')).toContainText('Apartment condition before moving out')
    await expect(page.locator('#receipt-summary')).toContainText('person@example.com')
    await expect(page.locator('#open-email')).toHaveText('Email ProofStamp again')
    await expect(page.locator('#email-return')).toBeVisible()
    await expect(page.locator('#email-return')).toContainText('Back from email?')

    await page.locator('#return-verify').click()
    await expect(page.locator('#verify-panel')).toBeVisible()
    await expect(page.locator('#expected-hash')).toHaveValue(/PROOFSTAMP/)
    await expect(page.locator('#expected-hash')).toHaveValue(/Apartment condition before moving out/)
    await expect(page.locator('#expected-hash')).toHaveValue(/return-photo\.jpg/)
    expect(apiRequests).toEqual([])
  })

  test('desktop opens email separately and keeps the ProofStamp tab intact', async ({ page }) => {
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

    const mailto = new URL(openCalls[0].url)
    const body = mailto.searchParams.get('body')
    expect(body).toContain('The email received time shows when this ProofStamp reached the inbox.')
    expect(body).not.toContain('Created at:')

    await expect(page.locator('#open-email')).toHaveText('Email ProofStamp again')
    await expect(page.locator('#email-status')).toContainText('Email opened separately')
    await expect(page.locator('#email-return')).toBeVisible()
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('proofstamp.emailOpened.v2'))).toBe('1')
  })

  test('a new ProofStamp gets a fresh local return state in the same session', async ({ page }) => {
    await createProofstamp(page)
    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v2', '1'))
    await page.reload()
    await expect(page.locator('#email-return')).toBeVisible()

    await page.locator('#return-create').click()
    await expect(page.locator('#file-stage')).toBeVisible()

    const secondPhoto = {
      name: 'second-return-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('proofstamp-second-email-return-photo')
    }
    await page.locator('#file-input').setInputFiles(secondPhoto)
    await expect(page.locator('#details-stage')).toBeVisible()
    await page.locator('#description').fill('Second ProofStamp in the same session')
    await page.locator('#primary-email').fill('person@example.com')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#receipt-stage')).toBeVisible()

    const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('proofstamp.currentReceipt.v2') || '{}'))
    expect(state.receipt.description).toBe('Second ProofStamp in the same session')
    expect(state.receipt).not.toHaveProperty('created_at_device')
  })

  test('restored clipboard failure shows a visible fallback', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('blocked') } }
      })
    })

    await createProofstamp(page)
    await page.evaluate(() => sessionStorage.setItem('proofstamp.emailOpened.v2', '1'))
    await page.reload()
    await page.locator('#copy-receipt').click()

    await expect(page.locator('[data-proofstamp-toast]')).toContainText('Use Save ProofStamp instead')
  })
})
