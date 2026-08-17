import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSha256, isSha256, sha256Bytes } from '../public/hash.js'

test('hashes exact bytes with SHA-256', async () => {
  const hash = await sha256Bytes(new TextEncoder().encode('abc'))
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('recognizes a valid SHA-256 value', () => {
  assert.equal(isSha256('a'.repeat(64)), true)
  assert.equal(isSha256('a'.repeat(63)), false)
  assert.equal(isSha256('z'.repeat(64)), false)
})

test('extracts a hash from a human-readable receipt', () => {
  const expected = 'B'.repeat(64)
  assert.equal(extractSha256(`SHA-256: ${expected}`), expected.toLowerCase())
})

test('different bytes produce different fingerprints', async () => {
  const first = await sha256Bytes(new TextEncoder().encode('original'))
  const second = await sha256Bytes(new TextEncoder().encode('changed'))
  assert.notEqual(first, second)
})
