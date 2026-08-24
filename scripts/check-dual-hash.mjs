import assert from 'node:assert/strict'
import { dualSha256Bytes } from '../public/dual-hash.js'
import { rustSha256Bytes } from '../public/rust-sha256.js'
import { sha256Bytes } from '../public/hash.js'

const vectors = [
  new Uint8Array(),
  new TextEncoder().encode('abc'),
  Uint8Array.from({ length: 65 }, (_, index) => index),
  Uint8Array.from({ length: (1024 * 1024) + 17 }, (_, index) => index % 251)
]

for (const bytes of vectors) {
  const browserHash = await sha256Bytes(bytes)
  const independentHash = await rustSha256Bytes(bytes)
  assert.equal(independentHash, browserHash)
  assert.equal(await dualSha256Bytes(bytes), browserHash)
}

assert.equal(
  await dualSha256Bytes(new TextEncoder().encode('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
)

console.log('Dual local SHA-256 checks passed')
