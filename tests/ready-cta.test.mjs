import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const indexPath = new URL('../public/index.html', import.meta.url)
const returnFlowPath = new URL('../public/return-flow.js', import.meta.url)

test('ready screen uses the ProofStamp-focused email CTA', async () => {
  const [html, returnFlow] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(returnFlowPath, 'utf8')
  ])

  assert.match(html, /<h2 id="receipt-stage-title">ProofStamp ready<\/h2>/)
  assert.match(html, /Your ProofStamp is ready to send\./)
  assert.match(html, />Email ProofStamp<\/button>/)
  assert.match(html, /Your email app will open with it ready to send\./)
  assert.match(html, /Optional: attach the originals\./)
  assert.match(returnFlow, /Email ProofStamp again/)
  assert.doesNotMatch(html, />Open email<\/button>/)
})
