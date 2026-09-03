import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createMailtoUrl, createReceipt, receiptToText } from '../public/receipt.js'

const indexPath = new URL('../public/index.html', import.meta.url)
const hash = 'b'.repeat(64)

test('email address is optional before preparing a ProofStamp', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.match(html, /<label for="primary-email">Email to <span>Optional<\/span><\/label>/)
  assert.match(html, /<input id="primary-email" type="email" autocomplete="email" placeholder="name@example\.com" \/>/)
  assert.match(html, /leave blank to save or copy the ProofStamp/i)
})

test('description is optional before preparing a ProofStamp', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.match(html, /<label for="description">Description <span>Optional<\/span><\/label>/)
  assert.match(html, /<textarea id="description" maxlength="500" rows="3" placeholder="Driveway before concrete removal"><\/textarea>/)
  assert.match(html, /Add context if it will help you recognize this later\./)
})

test('email composer can open without a prefilled recipient', () => {
  const receipt = createReceipt({
    hash,
    description: 'Local-only ProofStamp',
    fileName: 'example.txt',
    fileSizeBytes: 12,
    mediaType: 'text/plain'
  })

  const url = createMailtoUrl({ receipt, primaryEmail: '' })
  assert.match(url, /^mailto:\?subject=/)
  assert.match(url, /body=/)
})

test('human-readable receipt and mailto body preserve the plain-text signature', () => {
  const receipt = createReceipt({
    hash,
    description: 'Unicode signature check',
    fileName: 'example.txt',
    fileSizeBytes: 12,
    mediaType: 'text/plain'
  })

  const text = receiptToText(receipt)
  assert.equal(text.split('\n')[0], 'ProofStamp͘')

  const mailto = new URL(createMailtoUrl({ receipt }))
  assert.equal(mailto.searchParams.get('body').split('\r\n')[0], 'ProofStamp͘')
  assert.equal(mailto.searchParams.get('subject'), 'ProofStamp: Unicode signature check')
})

test('blank description falls back to the filename when it is included', () => {
  const receipt = createReceipt({
    hash,
    description: '',
    fileName: 'example.txt',
    fileSizeBytes: 12,
    mediaType: 'text/plain'
  })

  assert.equal(receipt.description, '')
  assert.match(receiptToText(receipt), /ProofStamp for: example\.txt/)
  assert.match(createMailtoUrl({ receipt }), /subject=ProofStamp%3A%20example\.txt/)
})

test('blank description uses neutral file count when filenames are hidden', () => {
  const receipt = createReceipt({
    hash,
    description: '',
    fileName: 'private-name.txt',
    includeFilename: false,
    fileSizeBytes: 12,
    mediaType: 'text/plain'
  })

  assert.equal(receipt.files[0].file_name, null)
  assert.match(receiptToText(receipt), /ProofStamp for: 1 file/)
  assert.doesNotMatch(receiptToText(receipt), /private-name\.txt/)
})

test('details step keeps the fingerprint out of the form and exposes it from the ready status', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.doesNotMatch(html, /class="proof-details"/)
  assert.doesNotMatch(html, /id="copy-hash"/)
  assert.match(html, /id="hash-status-row"/)
  assert.match(html, /See file fingerprint \(SHA-256\)/)
  assert.match(html, /id="hash-value"/)
})
