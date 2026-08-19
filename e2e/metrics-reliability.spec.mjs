import { test, expect } from '@playwright/test'

const receipt = {
  description: 'Mobile metric retry test',
  files: [{
    hash: 'a'.repeat(64),
    file_name: 'private-photo.jpg',
    file_size_bytes: 123,
    media_type: 'image/jpeg'
  }],
  created_at_device: '2026-08-19T20:15:00.000Z'
}

test('retries dropped mobile metrics without sending ProofStamp data', async ({ page }) => {
  const attempts = []
  const delivered = []
  let failRequests = true

  await page.route('**/api/metrics', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    const payload = JSON.parse(route.request().postData() || '{}')
    attempts.push(payload)

    if (failRequests) {
      await route.abort('failed')
      return
    }

    delivered.push(payload)
    await route.fulfill({ status: 204, body: '' })
  })

  await page.goto('/')
  await page.evaluate(async (value) => {
    const metrics = await import('/metrics.js')
    metrics.trackProofCreated(value)
    metrics.trackEmailAppOpened(value)
  }, receipt)

  await expect.poll(() => page.evaluate(() => {
    return JSON.parse(localStorage.getItem('proofstamp.metrics.queue.v2') || '[]').length
  })).toBe(2)

  expect(attempts).toHaveLength(2)
  for (const payload of attempts) {
    expect(Object.keys(payload).sort()).toEqual(
      payload.event === 'proof_created'
        ? ['event', 'eventId', 'fileCount']
        : ['event', 'eventId']
    )
    expect(JSON.stringify(payload)).not.toContain('private-photo.jpg')
    expect(JSON.stringify(payload)).not.toContain('Mobile metric retry test')
    expect(JSON.stringify(payload)).not.toContain('a'.repeat(64))
  }

  const originalEventIds = attempts.map((payload) => payload.eventId).sort()
  failRequests = false
  await page.reload()

  await expect.poll(() => page.evaluate(() => {
    return JSON.parse(localStorage.getItem('proofstamp.metrics.queue.v2') || '[]').length
  })).toBe(0)

  expect(delivered.map((payload) => payload.eventId).sort()).toEqual(originalEventIds)

  const deliveredCount = delivered.length
  await page.reload()
  await page.waitForTimeout(150)
  expect(delivered).toHaveLength(deliveredCount)
})
