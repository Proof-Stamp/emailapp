import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('verify route builds as a real extensionless Cloudflare page', async () => {
  const buildScript = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8')
  const appScript = await readFile(new URL('../public/app.js', import.meta.url), 'utf8')

  assert.match(buildScript, /writeFile\(resolve\(destination, 'verify\.html'\), homeHtml\)/)
  assert.match(appScript, /location\.pathname\.startsWith\('\/verify'\)/)
  assert.doesNotMatch(buildScript, /verifyDirectory|verify\/index\.html/)
})
