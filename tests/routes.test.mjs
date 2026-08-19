import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('stats route is served as a directory page without an html rewrite loop', async () => {
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')
  assert.doesNotMatch(redirects, /^\/stats\s+\/stats\.html\s+200$/m)
  assert.match(redirects, /^\/verify\s+\/index\.html\s+200$/m)

  const statsPage = await readFile(new URL('../public/stats/index.html', import.meta.url), 'utf8')
  assert.match(statsPage, /id="stats-title">ProofStamp usage</)
})
