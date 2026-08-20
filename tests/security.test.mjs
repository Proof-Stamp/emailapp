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
