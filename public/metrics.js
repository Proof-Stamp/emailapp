const METRICS_ENDPOINT = '/api/metrics'
const SESSION_PREFIX = 'proofstamp.metric.'
const QUEUE_KEY = 'proofstamp.metrics.queue.v2'
const MAX_QUEUED_EVENTS = 100

const createdReceiptKeys = new Set()
const openedReceiptKeys = new Set()
const feedbackReceiptKeys = new Set()
let flushPromise = null

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

function alreadyQueued(type, key, memorySet) {
  if (!key || memorySet.has(key) || sessionHas(type, key)) return true
  memorySet.add(key)
  markSession(type, key)
  return false
}

function createEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const random = Math.random().toString(36).slice(2)
  return `${Date.now().toString(36)}-${random}`
}

function readQueue() {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item?.eventId && item?.event) : []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  if (typeof localStorage === 'undefined') return
  try {
    if (!queue.length) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_EVENTS)))
  } catch {}
}

function queueMetric(payload) {
  if (!canTrack()) return null
  const item = { eventId: createEventId(), ...payload }
  const queue = readQueue()
  queue.push(item)
  writeQueue(queue)
  void flushMetrics()
  return item.eventId
}

function removeQueuedEvent(eventId) {
  writeQueue(readQueue().filter((item) => item.eventId !== eventId))
}

async function deliverMetric(item) {
  try {
    const response = await fetch(METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
      keepalive: true
    })
    if (!response.ok) return false
    removeQueuedEvent(item.eventId)
    return true
  } catch {
    return false
  }
}

export function flushMetrics() {
  if (!canTrack()) return Promise.resolve()
  if (flushPromise) return flushPromise

  flushPromise = (async () => {
    const attempted = new Set()
    while (true) {
      const pending = readQueue().filter((item) => !attempted.has(item.eventId))
      if (!pending.length) break

      for (const item of pending) {
        attempted.add(item.eventId)
        await deliverMetric(item)
      }
    }
  })().finally(() => {
    flushPromise = null
  })

  return flushPromise
}

function beaconQueuedMetrics() {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return

  for (const item of readQueue()) {
    try {
      const body = new Blob([JSON.stringify(item)], { type: 'application/json' })
      navigator.sendBeacon(METRICS_ENDPOINT, body)
    } catch {}
  }
}

export function trackProofCreated(receipt) {
  const fileCount = Array.isArray(receipt?.files) ? receipt.files.length : 1
  if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > 5) return

  const key = receiptKey(receipt)
  if (alreadyQueued('created', key, createdReceiptKeys)) return
  queueMetric({ event: 'proof_created', fileCount })
}

export function trackEmailAppOpened(receipt) {
  const key = receiptKey(receipt)
  if (alreadyQueued('opened', key, openedReceiptKeys)) return
  queueMetric({ event: 'email_opened' })
}

export function trackFeedback(receipt, response) {
  if (response !== 'yes' && response !== 'no') return false
  const key = receiptKey(receipt)
  if (alreadyQueued('feedback', key, feedbackReceiptKeys)) return false
  queueMetric({ event: response === 'yes' ? 'feedback_yes' : 'feedback_no' })
  return true
}

if (canTrack()) {
  queueMicrotask(() => { void flushMetrics() })
  window.addEventListener('online', () => { void flushMetrics() })
  window.addEventListener('focus', () => { void flushMetrics() })
  window.addEventListener('pageshow', () => { void flushMetrics() })
  window.addEventListener('pagehide', beaconQueuedMetrics)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushMetrics()
    else beaconQueuedMetrics()
  })
}
