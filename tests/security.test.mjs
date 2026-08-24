import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const headersPath = new URL('../public/_headers', import.meta.url)

test('CSP disables runtime network connections for the local-only utility', async () => {
  const headers = await readFile(headersPath, 'utf8')

  assert.match(headers, /connect-src 'none'/)
  assert.doesNotMatch(headers, /connect-src 'self'/)
  assert.match(headers, /default-src 'self'/)
  assert.match(headers, /object-src 'none'/)
})

test('CSP allows only same-origin workers and WebAssembly execution', async () => {
  const headers = await readFile(headersPath, 'utf8')

  assert.match(headers, /worker-src 'self'/)
  assert.match(headers, /script-src 'self' 'wasm-unsafe-eval'/)
  assert.doesNotMatch(headers, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/)
  assert.doesNotMatch(headers, /worker-src[^;]*(?:blob:|data:|https:)/)
})

test('CSP allows local blob image previews without enabling network image sources', async () => {
  const headers = await readFile(headersPath, 'utf8')

  assert.match(headers, /img-src 'self' data: blob:/)
  assert.doesNotMatch(headers, /img-src[^;]*https:/)
})
