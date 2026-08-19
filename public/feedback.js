import { trackFeedback } from './metrics.js'

const RECEIPT_KEY = 'proofstamp.currentReceipt.v1'
const FEEDBACK_KEY = 'proofstamp.feedback.v1'
const FEEDBACK_EMAIL = 'info@proofstamp.org'

function safeSessionGet(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}

function safeSessionSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch {}
}

function readReceipt() {
  const raw = safeSessionGet(RECEIPT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)?.receipt || null
  } catch {
    return null
  }
}

function feedbackMailto() {
  const subject = encodeURIComponent('ProofStamp feedback')
  const body = encodeURIComponent(
    'What happened?\r\n\r\nPlease do not include private files, fingerprints, or email addresses.'
  )
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
}

function renderFeedbackState(container, response) {
  const yes = container.querySelector('#feedback-yes')
  const no = container.querySelector('#feedback-no')
  const message = container.querySelector('#feedback-message')
  const detail = container.querySelector('#feedback-detail')

  if (!response) return

  yes.disabled = true
  no.disabled = true
  yes.setAttribute('aria-pressed', String(response === 'yes'))
  no.setAttribute('aria-pressed', String(response === 'no'))
  message.hidden = false

  if (response === 'yes') {
    message.textContent = 'Thanks. That helps.'
    detail.hidden = true
  } else {
    message.textContent = 'Thanks. A short note would help us fix it.'
    detail.hidden = false
  }
}

function submitFeedback(container, response) {
  if (safeSessionGet(FEEDBACK_KEY)) return
  const receipt = readReceipt()
  if (!receipt) return

  trackFeedback(receipt, response)
  safeSessionSet(FEEDBACK_KEY, response)
  renderFeedbackState(container, response)
}

function ensureFeedbackUi() {
  const returnPanel = document.querySelector('#email-return')
  if (!returnPanel || returnPanel.querySelector('#email-feedback')) return

  const feedback = document.createElement('div')
  feedback.id = 'email-feedback'
  feedback.className = 'email-feedback'
  feedback.innerHTML = `
    <strong>Did ProofStamp work as expected?</strong>
    <div class="email-feedback-actions" role="group" aria-label="ProofStamp feedback">
      <button id="feedback-yes" class="small-button" type="button" aria-pressed="false">Yes</button>
      <button id="feedback-no" class="small-button" type="button" aria-pressed="false">Not quite</button>
    </div>
    <p id="feedback-message" class="feedback-message" role="status" aria-live="polite" hidden></p>
    <a id="feedback-detail" class="feedback-detail" href="${feedbackMailto()}" hidden>Tell us what went wrong →</a>
  `

  returnPanel.append(feedback)
  feedback.querySelector('#feedback-yes').addEventListener('click', () => submitFeedback(feedback, 'yes'))
  feedback.querySelector('#feedback-no').addEventListener('click', () => submitFeedback(feedback, 'no'))

  renderFeedbackState(feedback, safeSessionGet(FEEDBACK_KEY))
}

ensureFeedbackUi()
new MutationObserver(ensureFeedbackUi).observe(document.body, { childList: true, subtree: true })
