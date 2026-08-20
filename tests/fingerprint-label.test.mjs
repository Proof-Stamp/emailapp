import test from 'node:test'
import assert from 'node:assert/strict'
import { createReceipt, receiptToText } from '../public/receipt.js'

const hash = 'a'.repeat(64)

test('human-readable ProofStamp names the SHA-256 value as the file fingerprint', () => {
  const receipt = createReceipt({
    hash,
    description: 'Driveway before repair',
    fileName: 'driveway.jpg',
    fileSizeBytes: 1024,
    mediaType: 'image/jpeg'
  })

  const text = receiptToText(receipt)
  assert.match(text, new RegExp(`SHA-256 hash / file fingerprint: ${hash}`))
})
