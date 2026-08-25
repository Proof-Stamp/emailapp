import './thumbnail-preview.js'
import { createMailtoUrl, receiptToText } from './receipt.js'

const RECEIPT_KEY = 'proofstamp.currentReceipt.v2'
const EMAIL_OPENED_KEY = 'proofstamp.emailOpened.v2'

const $ = (selector) => document.querySelector(selector)
const receiptStage = $('#receipt-stage')
const actionGrid = receiptStage?.querySelector('.action-grid')
const openEmailButton = $('#open-email')
const receiptSummary = $('#receipt-summary')
const providerCount = $('#receipt-provider-count')
const description = $('#description')
const primaryEmail = $('#primary-email')
const secondEmail = $('#second-email')
const includeFilename = $('#include-filename')

let restored = false
let savedState = readState()
let returnPanel
let emailStatus

function safeSessionGet(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}

function safeSessionSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch {}
}

function safeSessionRemove(key) {
  try { sessionStorage.removeItem(key) } catch {}
}

function showToast(message) {
  document.querySelector('[data-proofstamp-toast]')?.remove()
  const toast = document.createElement('div')
  toast.dataset.proofstampToast = 'true'
  toast.setAttribute('role', 'alert')
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', bottom: '1rem', zIndex: '1000', maxWidth: 'calc(100% - 2rem)',
    padding: '.8rem 1rem', borderRadius: '.7rem', background: 'var(--navy)', color: 'white', fontWeight: '700',
    fontSize: '.85rem', boxShadow: '0 12px 32px rgba(7, 27, 44, .22)', transform: 'translateX(-50%)'
  })
  document.body.append(toast)
  setTimeout(() => toast.remove(), 4500)
}

function readState() {
  const raw = safeSessionGet(RECEIPT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.receipt?.files?.length || !parsed?.delivery) return null
    return parsed
  } catch {
    return null
  }
}

function usesMobileMailHandoff() {
  const mobileHint = navigator.userAgentData?.mobile
  if (typeof mobileHint === 'boolean') return mobileHint

  const userAgent = navigator.userAgent || ''
  const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iPadDesktopMode || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

function parseBytes(text) {
  const match = String(text || '').trim().match(/^([\d.]+)\s*(B|KB|MB|GB)/i)
  if (!match) return 0
  const factors = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
  return Math.round(Number(match[1]) * factors[match[2].toUpperCase()])
}

function summaryRows() {
  return Array.from(receiptSummary?.querySelectorAll('dt') || []).map((dt) => [
    dt.textContent,
    dt.nextElementSibling?.textContent || ''
  ])
}

function summaryValue(label) {
  return summaryRows().find(([key]) => key === label)?.[1] || ''
}

function fingerprintFiles() {
  const rows = Array.from(document.querySelectorAll('#selected-files .selected-file'))
  const meta = rows.map((row) => {
    const name = row.querySelector('.file-copy strong')?.textContent || ''
    const detail = row.querySelector('.file-copy span')?.textContent || ''
    const [sizeText, mediaType = 'application/octet-stream'] = detail.split(' · ')
    return { name, size: parseBytes(sizeText), mediaType }
  })
  const fingerprintText = summaryValue('SHA-256 hash / file fingerprint') || summaryValue('SHA-256 hashes / file fingerprints')
  const hashes = fingerprintText.match(/[0-9a-f]{64}/gi) || []

  return hashes.map((hash, index) => ({
    hash: hash.toLowerCase(),
    file_name: includeFilename?.checked ? (meta[index]?.name || null) : null,
    file_size_bytes: meta[index]?.size || 0,
    media_type: meta[index]?.mediaType || 'application/octet-stream'
  }))
}

function captureState() {
  if (!receiptStage || receiptStage.hidden) return null
  const files = fingerprintFiles()
  if (!files.length) return null

  const state = {
    receipt: {
      description: description?.value.trim() || summaryValue('Description'),
      files,
      verification_url: 'https://email.proofstamp.org/verify'
    },
    delivery: {
      primaryEmail: primaryEmail?.value.trim() || '',
      secondEmail: secondEmail?.value.trim() || ''
    },
    summary: summaryRows(),
    providerCount: providerCount?.textContent || 'Saved locally'
  }
  savedState = state
  safeSessionSet(RECEIPT_KEY, JSON.stringify(state))
  return state
}

function clearSavedState() {
  savedState = null
  safeSessionRemove(RECEIPT_KEY)
  safeSessionRemove(EMAIL_OPENED_KEY)
}

function ensureReturnUi() {
  if (!actionGrid || emailStatus) return

  emailStatus = document.createElement('p')
  emailStatus.id = 'email-status'
  emailStatus.className = 'email-status'
  emailStatus.setAttribute('role', 'status')
  emailStatus.setAttribute('aria-live', 'polite')
  emailStatus.hidden = true

  returnPanel = document.createElement('div')
  returnPanel.id = 'email-return'
  returnPanel.className = 'email-return'
  returnPanel.hidden = true
  returnPanel.innerHTML = `
    <strong>Back from email?</strong>
    <p>Your ProofStamp is still here.</p>
    <div class="email-return-actions">
      <button id="return-create" class="secondary-button" type="button">Create another</button>
      <button id="return-verify" class="secondary-button" type="button">Check a file</button>
    </div>
  `

  actionGrid.insertAdjacentElement('afterend', emailStatus)
  emailStatus.insertAdjacentElement('afterend', returnPanel)

  $('#return-create')?.addEventListener('click', () => {
    clearSavedState()
    location.href = '/'
  })
  $('#return-verify')?.addEventListener('click', () => {
    const state = savedState || captureState()
    if (state) $('#expected-hash').value = receiptToText(state.receipt)
    $('#verify-tab')?.click()
  })
}

function showEmailOpenedState({ showReturn = false, desktop = false } = {}) {
  ensureReturnUi()
  if (openEmailButton) openEmailButton.textContent = 'Email ProofStamp again'
  if (emailStatus) {
    emailStatus.textContent = desktop
      ? 'Email opened separately. Come back here after sending.'
      : 'Email opened. Come back here after sending.'
    emailStatus.hidden = false
  }
  if (returnPanel && showReturn) returnPanel.hidden = false
}

function restoreState() {
  if (!savedState || !receiptStage) return false
  restored = true

  $('#file-stage').hidden = true
  $('#details-stage').hidden = true
  receiptStage.hidden = false

  receiptSummary.replaceChildren(...savedState.summary.flatMap(([key, value]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = key
    dd.textContent = value
    return [dt, dd]
  }))
  if (providerCount) providerCount.textContent = savedState.providerCount

  const intro = receiptStage.querySelector('.success-intro')
  if (intro) intro.textContent = 'Your ProofStamp is ready. Email it, save it, or copy it.'

  if (safeSessionGet(EMAIL_OPENED_KEY) === '1') showEmailOpenedState({ showReturn: true })
  return true
}

function mailtoForSavedState() {
  if (!savedState) return null
  const { receipt, delivery } = savedState
  return createMailtoUrl({ receipt, primaryEmail: delivery.primaryEmail, secondEmail: delivery.secondEmail })
}

function openRestoredEmail() {
  const mailto = mailtoForSavedState()
  if (mailto) location.href = mailto
}

function openDesktopEmail() {
  const mailto = mailtoForSavedState()
  if (!mailto) return
  window.open(mailto, '_blank', 'noopener,noreferrer')
}

async function copyRestoredReceipt() {
  if (!savedState) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(receiptToText(savedState.receipt))
    showToast('ProofStamp copied.')
  } catch {
    showToast('Copying was blocked. Use Save ProofStamp instead.')
  }
}

function downloadRestoredReceipt() {
  if (!savedState) return
  const text = receiptToText(savedState.receipt)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `proofstamp-${savedState.receipt.files[0].hash.slice(0, 12)}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function handleReceiptVisible() {
  if (!receiptStage || receiptStage.hidden) return
  const intro = receiptStage.querySelector('.success-intro')
  if (intro) intro.textContent = 'Your ProofStamp is ready. Email it, save it, or copy it.'
  if (openEmailButton && safeSessionGet(EMAIL_OPENED_KEY) !== '1') openEmailButton.textContent = 'Email ProofStamp'
  ensureReturnUi()
  if (!restored) captureState()
}

if (receiptStage) {
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.href = '/return-flow.css?v=0.4.5'
  document.head.append(style)

  ensureReturnUi()
  restoreState()
  handleReceiptVisible()

  new MutationObserver(handleReceiptVisible).observe(receiptStage, { attributes: true, attributeFilter: ['hidden'] })

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button')
    if (!target) return

    if (target.id === 'open-email') {
      if (!savedState) captureState()
      safeSessionSet(EMAIL_OPENED_KEY, '1')

      if (!usesMobileMailHandoff() && savedState) {
        event.preventDefault()
        event.stopImmediatePropagation()
        showEmailOpenedState({ showReturn: true, desktop: true })
        openDesktopEmail()
        return
      }

      showEmailOpenedState()
      if (restored) {
        event.preventDefault()
        event.stopImmediatePropagation()
        openRestoredEmail()
      }
      return
    }

    if (target.id === 'copy-receipt' && restored) {
      event.preventDefault()
      event.stopImmediatePropagation()
      copyRestoredReceipt()
      return
    }

    if (target.id === 'download-receipt' && restored) {
      event.preventDefault()
      event.stopImmediatePropagation()
      downloadRestoredReceipt()
      return
    }

    if (target.id === 'create-another') {
      clearSavedState()
      if (restored) {
        event.preventDefault()
        event.stopImmediatePropagation()
        location.href = '/'
      }
    }
  }, true)

  const maybeShowReturn = () => {
    if (!receiptStage.hidden && safeSessionGet(EMAIL_OPENED_KEY) === '1') showEmailOpenedState({ showReturn: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeShowReturn()
  })
  window.addEventListener('focus', maybeShowReturn)
  window.addEventListener('pageshow', maybeShowReturn)
}
