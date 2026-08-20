import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const indexPath = new URL('../public/index.html', import.meta.url)
const helperPath = new URL('../public/media-preservation.js', import.meta.url)

test('mobile picker explains how to reach photos and documents', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.match(html, /Photos &amp; videos/)
  assert.match(html, /Files, My Files, Documents, or Browse/)
  assert.match(html, /Just used Camera, Video, or Recorder\?/)
  assert.match(html, /Save an original copy before leaving\./)
})

test('captured-media safety helper saves exact selected media locally', async () => {
  const source = await readFile(helperPath, 'utf8')

  assert.match(source, /URL\.createObjectURL\(file\)/)
  assert.match(source, /link\.download = file\.name/)
  assert.match(source, /link\.click\(\)/)
  assert.match(source, /URL\.revokeObjectURL\(url\)/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/)
})
