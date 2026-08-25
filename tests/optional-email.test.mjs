import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createMailtoUrl, createReceipt } from '../public/receipt.js'

const indexPath = new URL('../public/index.html', import.meta.url)
const hash = 'b'.repeat(64)

test('email address is optional before preparing a ProofStamp', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.match(html, /<label for="primary-email">Email to <span>Optional<\/span><\/label>/)
  assert.match(html, /<input id="primary-email" type="email" autocomplete="email" placeholder="name@example\.com" \/>/)
  assert.match(html, /leave blank to save or copy the ProofStamp/i)
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

test('details step keeps the fingerprint out of the form and exposes it from the ready status', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.doesNotMatch(html, /class="proof-details"/)
  assert.doesNotMatch(html, /id="copy-hash"/)
  assert.match(html, /id="hash-status-row"/)
  assert.match(html, /See file fingerprint \(SHA-256\)/)
  assert.match(html, /id="hash-value"/)
})
