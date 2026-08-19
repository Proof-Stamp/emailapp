import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const headersPath = new URL('../public/_headers', import.meta.url)

test('CSP allows same-origin API requests while keeping external connections blocked', async () => {
  const headers = await readFile(headersPath, 'utf8')

  assert.match(headers, /connect-src 'self'/)
  assert.doesNotMatch(headers, /connect-src 'none'/)
  assert.match(headers, /default-src 'self'/)
  assert.match(headers, /object-src 'none'/)
})
