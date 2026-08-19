const METRICS_ENDPOINT = '/api/metrics'
const createdReceiptKeys = new Set()
const openedReceiptKeys = new Set()

function canTrack() {
  return typeof window !== 'undefined' && typeof fetch === 'function'
}

function receiptKey(receipt) {
  const firstHash = receipt?.files?.[0]?.hash || receipt?.hash || ''
  return `${receipt?.created_at_device || ''}:${firstHash}`
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
  if (createdReceiptKeys.has(key)) return
  createdReceiptKeys.add(key)
  sendMetric({ event: 'proof_created', fileCount })
}

export function trackEmailAppOpened(receipt) {
  const key = receiptKey(receipt)
  if (!key || openedReceiptKeys.has(key)) return
  openedReceiptKeys.add(key)
  sendMetric({ event: 'email_opened' })
}
