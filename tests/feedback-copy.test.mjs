import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const feedbackPath = new URL('../public/feedback.js', import.meta.url)

test('feedback follow-up uses the ProofStamp info inbox and warns against private data', async () => {
  const feedback = await readFile(feedbackPath, 'utf8')

  assert.match(feedback, /info@proofstamp\.org/)
  assert.match(feedback, /Please do not include private files, fingerprints, or email addresses\./)
  assert.match(feedback, /Did ProofStamp work as expected\?/)
  assert.match(feedback, /trackFeedback/)
})
