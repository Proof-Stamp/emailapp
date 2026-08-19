import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSha256, isSha256, sha256Bytes } from '../public/hash.js'
import {
  RECEIPT_SCHEMA,
  createMailtoUrl,
  createReceipt,
  formatReceiptDate,
  isValidEmail,
  parseReceiptJson,
  receiptToText
} from '../public/receipt.js'

const receiptHash = 'a'.repeat(64)
const receipt = createReceipt({
  hash: receiptHash,
  description: 'Apartment condition before moving in',
  fileName: 'bedroom.jpg',
  includeFilename: true,
  fileSizeBytes: 2048,
  mediaType: 'image/jpeg',
  createdAtDevice: '2026-08-17T12:00:00.000Z'
})

test('hashes exact bytes with SHA-256', async () => {
  const hash = await sha256Bytes(new TextEncoder().encode('abc'))
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('recognizes a valid SHA-256 value', () => {
  assert.equal(isSha256('a'.repeat(64)), true)
  assert.equal(isSha256('a'.repeat(63)), false)
  assert.equal(isSha256('z'.repeat(64)), false)
})

test('extracts a hash from a human-readable ProofStamp', () => {
  const expected = 'B'.repeat(64)
  assert.equal(extractSha256(`SHA-256: ${expected}`), expected.toLowerCase())
})

test('different bytes produce different fingerprints', async () => {
  const first = await sha256Bytes(new TextEncoder().encode('original'))
  const second = await sha256Bytes(new TextEncoder().encode('changed'))
  assert.notEqual(first, second)
})

test('creates a portable ProofStamp without email addresses', () => {
  assert.equal(receipt.schema, RECEIPT_SCHEMA)
  assert.equal(receipt.hash, receiptHash)
  assert.equal(receipt.file_name, 'bedroom.jpg')
  assert.equal('primaryEmail' in receipt, false)
  assert.equal('secondEmail' in receipt, false)
})

test('omits a private filename when requested', () => {
  const privateReceipt = createReceipt({
    hash: receiptHash,
    description: 'Private document',
    fileName: 'medical-record.pdf',
    includeFilename: false,
    fileSizeBytes: 512,
    mediaType: 'application/pdf'
  })
  assert.equal(privateReceipt.file_name, null)
})

test('formats the device timestamp for a human reader', () => {
  assert.equal(
    formatReceiptDate('2026-08-19T00:24:41.927Z'),
    'August 19, 2026 at 12:24 AM UTC'
  )
})

test('builds a standards-friendly mailto URL with a second mailbox and complete ProofStamp', () => {
  const mailto = createMailtoUrl({
    receipt,
    primaryEmail: 'person@example.com',
    secondEmail: 'backup@example.net'
  })
  assert.equal(mailto.includes('+'), false)
  assert.equal(mailto.includes('%20'), true)
  assert.equal(mailto.includes('%0D%0A'), true)
  const url = new URL(mailto)
  assert.equal(url.protocol, 'mailto:')
  assert.equal(decodeURIComponent(url.pathname), 'person@example.com')
  assert.equal(url.searchParams.get('cc'), 'backup@example.net')
  assert.match(url.searchParams.get('body'), new RegExp(receiptHash))
  assert.match(url.searchParams.get('body'), /I sent you a ProofStamp/)
  assert.match(url.searchParams.get('body'), /VERIFY A FILE/)
  assert.match(url.searchParams.get('body'), /Need to create your own\?/)
  assert.match(url.searchParams.get('body'), /ProofStamp a file: https:\/\/email\.proofstamp\.org\//)
  assert.match(url.searchParams.get('body'), /received time on this email records when this ProofStamp reached the inbox/)
})

test('renders a readable, recipient-friendly text ProofStamp', () => {
  const text = receiptToText(receipt)
  assert.match(text, /I sent you a ProofStamp/)
  assert.match(text, /For: Apartment condition before moving in/)
  assert.match(text, /VERIFY A FILE/)
  assert.match(text, /File size: 2.0 KB \(2048 bytes\)/)
  assert.match(text, /SHA-256 fingerprint:\na{64}/)
  assert.match(text, /Created on this device: August 17, 2026 at 12:00 PM UTC/)
  assert.match(text, /Need to create your own\?/)
})

test('accepts valid email addresses and rejects invalid ones', () => {
  assert.equal(isValidEmail('person@example.com'), true)
  assert.equal(isValidEmail('not-an-email'), false)
})

test('loads only valid ProofStamp JSON receipts', () => {
  assert.equal(parseReceiptJson(JSON.stringify(receipt)).hash, receiptHash)
  assert.throws(() => parseReceiptJson(JSON.stringify({ hash: receiptHash })), /Invalid ProofStamp file/)
  assert.throws(() => parseReceiptJson('{not json'))
})
