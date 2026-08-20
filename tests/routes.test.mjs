import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('verify route rewrites to the local single-page verifier', async () => {
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')
  assert.match(redirects, /^\/verify\s+\/index\.html\s+200$/m)
  assert.doesNotMatch(redirects, /\/stats|\/api\//)
})
