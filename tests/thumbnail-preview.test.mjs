import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const previewPath = new URL('../public/thumbnail-preview.js', import.meta.url)
const returnFlowPath = new URL('../public/return-flow.js', import.meta.url)

test('local thumbnail preview helper is loaded by the app', async () => {
  const returnFlow = await readFile(returnFlowPath, 'utf8')
  assert.match(returnFlow, /import '\.\/thumbnail-preview\.js'/)
})

test('thumbnail previews are decoded locally and never require a network request', async () => {
  const source = await readFile(previewPath, 'utf8')

  assert.match(source, /new FileReader\(\)/)
  assert.match(source, /readAsDataURL\(file\)/)
  assert.match(source, /canvas\.toDataURL\('image\/jpeg'/)
  assert.match(source, /Browser cannot preview this image format/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /https?:\/\//)
})
