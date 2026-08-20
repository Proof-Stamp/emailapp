import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('verify route stays on the dedicated verifier entry point', async () => {
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')
  const buildScript = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8')

  assert.match(redirects, /^\/verify\s+\/verify\/index\.html\s+200$/m)
  assert.match(redirects, /^\/verify\/\s+\/verify\/index\.html\s+200$/m)
  assert.doesNotMatch(redirects, /^\/verify\s+\/index\.html\s+200$/m)
  assert.doesNotMatch(redirects, /\/stats|\/api\//)

  assert.match(buildScript, /resolve\(destination, 'verify'\)/)
  assert.match(buildScript, /writeFile\(resolve\(verifyDirectory, 'index\.html'\), homeHtml\)/)
})
