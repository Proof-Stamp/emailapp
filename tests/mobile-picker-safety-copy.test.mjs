import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8')

test('mobile picker guidance keeps photo and document routes explicit', () => {
  assert.match(html, /Photos &amp; videos/)
  assert.match(html, /PDFs or documents/)
  assert.match(html, /Files, My Files, Documents, or Browse/)
})

test('mobile-created media gets a preservation warning and save action', () => {
  assert.match(html, /Just used Camera, Video, or Recorder\?/)
  assert.match(html, /Save an original copy before leaving/)
  assert.match(html, /id="save-selected-media"/)
})
