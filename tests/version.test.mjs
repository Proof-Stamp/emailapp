import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_VERSION } from '../public/receipt.js'

function assertSourceReleaseSync(html, version) {
  assert.match(html, new RegExp(`ProofStamp · v${version.replaceAll('.', '\\.')}`))

  const localAssets = Array.from(
    html.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js|svg)(?:\?v=[^"]+)?)"/g),
    (match) => match[1]
  )

  assert.ok(localAssets.length > 0)
  localAssets.forEach((asset) => {
    assert.ok(
      asset.endsWith(`?v=${version}`),
      `Expected ${asset} to use release version ${version}`
    )
  })
}

test('package, receipt, source HTML, and build release versions stay in sync', async () => {
  const root = resolve(import.meta.dirname, '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const buildScript = await readFile(resolve(root, 'scripts/build.mjs'), 'utf8')
  const homeHtml = await readFile(resolve(root, 'public/index.html'), 'utf8')

  assert.equal(APP_VERSION, packageJson.version)
  assertSourceReleaseSync(homeHtml, packageJson.version)
  assert.match(buildScript, /ProofStamp · v\$\{appVersion\}/)
  assert.match(buildScript, /\?v=\$\{appVersion\}/)
})
