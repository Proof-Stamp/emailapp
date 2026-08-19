const METRICS_ENDPOINT = '/api/metrics'
const SESSION_PREFIX = 'proofstamp.metric.'
const createdReceiptKeys = new Set()
const openedReceiptKeys = new Set()

function canTrack() {
  return typeof window !== 'undefined' && typeof fetch === 'function'
}

function receiptKey(receipt) {
  const firstHash = receipt?.files?.[0]?.hash || receipt?.hash || ''
  return `${receipt?.created_at_device || ''}:${firstHash}`
}

function sessionHas(type, key) {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(`${SESSION_PREFIX}${type}:${key}`) === '1'
  } catch {
    return false
  }
}

function markSession(type, key) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${type}:${key}`, '1')
  } catch {}
}

function alreadyTracked(type, key, memorySet) {
  if (!key || memorySet.has(key) || sessionHas(type, key)) return true
  memorySet.add(key)
  markSession(type, key)
  return false
}

function sendMetric(payload) {
  if (!canTrack()) return
  fetch(METRICS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {})
}

export function trackProofCreated(receipt) {
  const fileCount = Array.isArray(receipt?.files) ? receipt.files.length : 1
  if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > 5) return

  const key = receiptKey(receipt)
  if (alreadyTracked('created', key, createdReceiptKeys)) return
  sendMetric({ event: 'proof_created', fileCount })
}

export function trackEmailAppOpened(receipt) {
  const key = receiptKey(receipt)
  if (alreadyTracked('opened', key, openedReceiptKeys)) return
  sendMetric({ event: 'email_opened' })
}
