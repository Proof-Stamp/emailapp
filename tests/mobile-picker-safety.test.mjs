import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { looksLikeFreshCapture } from '../public/capture-detection.js'

const indexPath = new URL('../public/index.html', import.meta.url)
const helperPath = new URL('../public/media-preservation.js', import.meta.url)

test('mobile picker explains how to reach photos and documents', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.match(html, /Photos &amp; videos/)
  assert.match(html, /Files, My Files, Documents, or Browse/)
  assert.match(html, /New camera or recorder file/)
  assert.match(html, /Save the original before continuing\./)
})

test('fresh-capture detection only flags recent media created during the picker session', () => {
  const pickerOpenedAt = 1_000_000
  const pickerReturnedAt = 1_020_000

  assert.equal(looksLikeFreshCapture({ type: 'image/jpeg', lastModified: 1_010_000 }, { pickerOpenedAt, pickerReturnedAt }), true)
  assert.equal(looksLikeFreshCapture({ type: 'audio/m4a', lastModified: 1_015_000 }, { pickerOpenedAt, pickerReturnedAt }), true)
  assert.equal(looksLikeFreshCapture({ type: 'video/mp4', lastModified: 900_000 }, { pickerOpenedAt, pickerReturnedAt }), false)
  assert.equal(looksLikeFreshCapture({ type: 'image/jpeg', lastModified: 900_000 }, { pickerOpenedAt, pickerReturnedAt }), false)
  assert.equal(looksLikeFreshCapture({ type: 'application/pdf', lastModified: 1_010_000 }, { pickerOpenedAt, pickerReturnedAt }), false)
  assert.equal(looksLikeFreshCapture({ type: 'image/jpeg', lastModified: 1_010_000 }, { pickerOpenedAt: 0, pickerReturnedAt }), false)
})

test('captured-media safety helper saves exact detected captures locally', async () => {
  const source = await readFile(helperPath, 'utf8')

  assert.match(source, /looksLikeFreshCapture/)
  assert.match(source, /fileInput\?\.addEventListener\('click', recordPickerOpen/)
  assert.match(source, /URL\.createObjectURL\(file\)/)
  assert.match(source, /link\.download = file\.name/)
  assert.match(source, /link\.click\(\)/)
  assert.match(source, /URL\.revokeObjectURL\(url\)/)
  assert.match(source, /focusSafetyAction/)
  assert.match(source, /focusDescription/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/)
})
