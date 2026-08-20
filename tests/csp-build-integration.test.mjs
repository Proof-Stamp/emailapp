import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const buildPath = new URL('../scripts/build.mjs', import.meta.url)

test('production build adds the exact JSON-LD hash to the deployed CSP', async () => {
  const build = await readFile(buildPath, 'utf8')

  assert.match(build, /const jsonLdText = JSON\.stringify\(structuredData\)/)
  assert.match(build, /sha256CspSource\(jsonLdText\)/)
  assert.match(build, /addScriptHashToCsp\(headers, jsonLdCspHash\)/)
  assert.doesNotMatch(build, /unsafe-inline|unsafe-eval/)
})
