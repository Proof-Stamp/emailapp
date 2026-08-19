import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_VERSION } from '../public/receipt.js'

test('package and receipt app versions stay in sync', async () => {
  const root = resolve(import.meta.dirname, '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const buildScript = await readFile(resolve(root, 'scripts/build.mjs'), 'utf8')

  assert.equal(APP_VERSION, packageJson.version)
  assert.match(buildScript, /ProofStamp · v\$\{appVersion\}/)
  assert.match(buildScript, /\?v=\$\{appVersion\}/)
})
