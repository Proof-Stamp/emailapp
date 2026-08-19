import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_VERSION } from '../public/receipt.js'

test('package, receipt, and source footer versions stay in sync', async () => {
  const root = resolve(import.meta.dirname, '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const homeHtml = await readFile(resolve(root, 'public/index.html'), 'utf8')
  const statsHtml = await readFile(resolve(root, 'public/stats/index.html'), 'utf8')
  const footerVersion = `ProofStamp · v${packageJson.version}`

  assert.equal(APP_VERSION, packageJson.version)
  assert.match(homeHtml, new RegExp(footerVersion.replaceAll('.', '\\.')))
  assert.match(statsHtml, new RegExp(footerVersion.replaceAll('.', '\\.')))
})
