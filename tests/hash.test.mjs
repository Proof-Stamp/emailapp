import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_FILES_PER_PROOFSTAMP,
  extractProofstampFileHashes,
  extractSha256,
  isSha256,
  sha256Bytes
} from '../public/hash.js'
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
const secondHash = 'b'.repeat(64)
const thirdHash = 'c'.repeat(64)

const receipt = createReceipt({
  hash: receiptHash,
  description: 'Apartment condition before moving in',
  fileName: 'bedroom.jpg',
  includeFilename: true,
  fileSizeBytes: 2048,
  mediaType: 'image/jpeg',
  createdAtDevice: '2026-08-17T12:00:00.000Z'
})

const multiReceipt = createReceipt({
  description: 'Apartment condition before moving out',
  includeFilename: true,
  files: [
    { hash: receiptHash, fileName: 'front.jpg', fileSizeBytes: 1024, mediaType: 'image/jpeg' },
    { hash: secondHash, fileName: 'kitchen.jpg', fileSizeBytes: 2048, mediaType: 'image/jpeg' },
    { hash: thirdHash, fileName: 'bedroom.jpg', fileSizeBytes: 3072, mediaType: 'image/jpeg' }
  ],
  createdAtDevice: '2026-08-19T16:24:00.000Z'
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

test('creates a portable single-file ProofStamp without email addresses', () => {
  assert.equal(receipt.schema, RECEIPT_SCHEMA)
  assert.equal(receipt.version, '2.0')
  assert.equal(receipt.files.length, 1)
  assert.equal(receipt.files[0].hash, receiptHash)
  assert.equal(receipt.files[0].file_name, 'bedroom.jpg')
  assert.equal('primaryEmail' in receipt, false)
  assert.equal('secondEmail' in receipt, false)
})

test('creates one ProofStamp for several files', () => {
  assert.equal(multiReceipt.files.length, 3)
  assert.equal(multiReceipt.files[1].file_name, 'kitchen.jpg')
  assert.equal(multiReceipt.files[2].hash, thirdHash)
})

test('omits private filenames from every file when requested', () => {
  const privateReceipt = createReceipt({
    description: 'Private records',
    includeFilename: false,
    files: [
      { hash: receiptHash, fileName: 'medical-record-1.pdf', fileSizeBytes: 512, mediaType: 'application/pdf' },
      { hash: secondHash, fileName: 'medical-record-2.pdf', fileSizeBytes: 1024, mediaType: 'application/pdf' }
    ]
  })
  assert.equal(privateReceipt.files[0].file_name, null)
  assert.equal(privateReceipt.files[1].file_name, null)
})

test('limits a ProofStamp to five files', () => {
  const files = Array.from({ length: MAX_FILES_PER_PROOFSTAMP + 1 }, (_, index) => ({
    hash: index % 2 ? receiptHash : secondHash,
    fileName: `file-${index}.jpg`,
    fileSizeBytes: 100,
    mediaType: 'image/jpeg'
  }))
  assert.throws(() => createReceipt({ description: 'Too many', files }), /Choose between 1 and 5 files/)
})

test('formats the device timestamp for a human reader', () => {
  assert.equal(
    formatReceiptDate('2026-08-19T00:24:41.927Z'),
    'August 19, 2026 at 12:24 AM UTC'
  )
})

test('builds a standards-friendly mailto URL with complete single-file ProofStamp', () => {
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
  assert.match(url.searchParams.get('body'), /VERIFY THE FILE/)
  assert.match(url.searchParams.get('body'), /Free\. Private\. No registration\. Your file stays on your device\./)
  assert.match(url.searchParams.get('body'), /ProofStamp your own file →/)
})

test('renders a concise multi-file ProofStamp email', () => {
  const text = receiptToText(multiReceipt)
  assert.match(text, /3 files were fingerprinted/)
  assert.match(text, /VERIFY THE FILES/)
  assert.match(text, /1\. front\.jpg · 1\.0 KB/)
  assert.match(text, /2\. kitchen\.jpg · 2\.0 KB/)
  assert.match(text, /3\. bedroom\.jpg · 3\.0 KB/)
  assert.doesNotMatch(text, /Set fingerprint/)
  assert.match(text, /Created at: August 19, 2026 at 4:24 PM UTC/)
  assert.match(text, /Free\. Private\. No registration\. Your files stay on your device\./)
  assert.match(text, /ProofStamp your own files →/)
  assert.doesNotMatch(text, /Created on this device/)
})

test('extracts every file fingerprint from a multi-file ProofStamp', () => {
  const text = receiptToText(multiReceipt)
  assert.deepEqual(extractProofstampFileHashes(text), [receiptHash, secondHash, thirdHash])
})

test('accepts valid email addresses and rejects invalid ones', () => {
  assert.equal(isValidEmail('person@example.com'), true)
  assert.equal(isValidEmail('not-an-email'), false)
})

test('loads current multi-file and legacy single-file JSON receipts', () => {
  const parsedMulti = parseReceiptJson(JSON.stringify(multiReceipt))
  assert.equal(parsedMulti.files.length, 3)

  const legacy = {
    schema: RECEIPT_SCHEMA,
    version: '1.0',
    hash_algorithm: 'SHA-256',
    hash: receiptHash,
    description: 'Legacy file',
    file_name: 'legacy.jpg',
    file_size_bytes: 500,
    media_type: 'image/jpeg'
  }
  assert.equal(parseReceiptJson(JSON.stringify(legacy)).hash, receiptHash)
  assert.throws(() => parseReceiptJson(JSON.stringify({ hash: receiptHash })), /Invalid ProofStamp file/)
  assert.throws(() => parseReceiptJson('{not json'))
})
