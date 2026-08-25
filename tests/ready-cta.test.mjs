import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const indexPath = new URL('../public/index.html', import.meta.url)
const returnFlowPath = new URL('../public/return-flow.js', import.meta.url)

test('ready screen keeps email primary while showing attachment guidance immediately', async () => {
  const [html, returnFlow] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(returnFlowPath, 'utf8')
  ])

  assert.match(html, /<h2 id="receipt-stage-title">ProofStamp ready<\/h2>/)
  assert.match(html, /Your ProofStamp is ready\. Email it, save it, or copy it\./)
  assert.match(html, />Email ProofStamp<\/button>/)
  assert.match(html, /Your email app will open with it ready to send\./)
  assert.match(html, /Optional: attach the originals before sending\./)
  assert.match(returnFlow, /Email ProofStamp again/)
  assert.doesNotMatch(html, />Open email<\/button>/)

  const emailButton = html.indexOf('id="open-email"')
  const attachmentNote = html.indexOf('class="attach-note"')
  const receiptPreview = html.indexOf('class="receipt-preview"')

  assert.ok(emailButton !== -1 && attachmentNote !== -1 && receiptPreview !== -1)
  assert.ok(emailButton < attachmentNote, 'Attachment guidance should follow the email action.')
  assert.ok(attachmentNote < receiptPreview, 'Attachment guidance should appear before the long receipt preview.')
})
