import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HashEngineDisagreementError, assertHashesAgree } from '../public/hash-agreement.js'

test('hash agreement guard fails closed on disagreement', () => {
  const hash = 'a'.repeat(64)
  assert.equal(assertHashesAgree(hash, hash), hash)
  assert.throws(
    () => assertHashesAgree(hash, 'b'.repeat(64)),
    HashEngineDisagreementError
  )
})

test('local verifier reads each file once and transfers that buffer to a module worker', async () => {
  const source = await readFile(new URL('../public/local-verifier.js', import.meta.url), 'utf8')
  const reads = source.match(/file\.arrayBuffer\(\)/g) || []

  assert.equal(reads.length, 1)
  assert.match(source, /new Worker\(new URL\('\.\/local-verifier-worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/)
  assert.match(source, /postMessage\(\{ id, buffer \}, \[buffer\]\)/)
})

test('verification modules contain no file-upload or runtime fetch path', async () => {
  const paths = [
    '../public/local-verifier.js',
    '../public/local-verifier-worker.js',
    '../public/dual-hash.js',
    '../public/rust-sha256.js'
  ]

  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\bfetch\s*\(/)
    assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|EventSource/)
  }
})

test('create flow keeps Web Crypto while verify flow uses dual local verifier', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8')

  assert.match(source, /existing\.get\(key\) \|\| await sha256File\(file\)/)
  assert.match(source, /actual\.push\(\{ file, hash: await verifyFileLocally\(file\) \}\)/)
  assert.match(source, /Verified locally/)
})
