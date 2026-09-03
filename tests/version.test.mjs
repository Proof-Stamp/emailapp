import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { addModuleReleaseVersion, addReleaseVersion } from '../scripts/release-version.mjs'

function assertBuiltHtmlReleaseSync(html, version) {
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

test('package.json is the single release-version source for built assets and receipts', async () => {
  const root = resolve(import.meta.dirname, '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const buildScript = await readFile(resolve(root, 'scripts/build.mjs'), 'utf8')
  const homeHtml = await readFile(resolve(root, 'public/index.html'), 'utf8')
  const receiptSource = await readFile(resolve(root, 'public/receipt.js'), 'utf8')

  assert.match(buildScript, /const appVersion = packageJson\.version/)
  assert.match(buildScript, /addReleaseVersion\([^\n]+, appVersion\)/)
  assert.match(buildScript, /addModuleReleaseVersion\(receiptSource, appVersion\)/)
  assert.doesNotMatch(receiptSource, /export const APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'/)

  const builtHtml = addReleaseVersion(homeHtml, packageJson.version)
  assertBuiltHtmlReleaseSync(builtHtml, packageJson.version)

  const builtReceipt = addModuleReleaseVersion(receiptSource, packageJson.version)
  assert.match(
    builtReceipt,
    new RegExp(`export const APP_VERSION = '${packageJson.version.replaceAll('.', '\\.')}'`)
  )

  // Prove stale source markup cannot force a release mismatch on the next bump.
  const probeVersion = '9.8.7'
  assertBuiltHtmlReleaseSync(addReleaseVersion(homeHtml, probeVersion), probeVersion)
  assert.match(addModuleReleaseVersion(receiptSource, probeVersion), /export const APP_VERSION = '9\.8\.7'/)
})

test('Cloudflare build command gates preview deploys on fast tests', async () => {
  const root = resolve(import.meta.dirname, '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))

  assert.match(packageJson.scripts.build, /npm test/)
  assert.match(packageJson.scripts.build, /build:static/)
  assert.equal(packageJson.scripts['build:static'], 'node scripts/build.mjs')
  assert.match(packageJson.scripts.check, /npm test/)
  assert.match(packageJson.scripts.check, /test:e2e/)
})
