import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_VERSION } from '../public/receipt.js'

test('package and receipt app versions stay in sync', async () => {
  const packageJson = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
  assert.equal(APP_VERSION, packageJson.version)
})
