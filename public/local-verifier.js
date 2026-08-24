export class LocalVerificationError extends Error {
  constructor(code) {
    super(`Local verification failed: ${code}`)
    this.name = 'LocalVerificationError'
    this.code = code
  }
}

const VERIFICATION_TIMEOUT_MS = 120_000
const SHA256_HEX = /^[a-f0-9]{64}$/
let worker = null
let requestId = 0
const pending = new Map()

function rejectPending(code) {
  pending.forEach(({ reject, timeout }) => {
    clearTimeout(timeout)
    reject(new LocalVerificationError(code))
  })
  pending.clear()
}

function resetWorker(code = 'engine-failure') {
  if (worker) worker.terminate()
  worker = null
  rejectPending(code)
}

function getWorker() {
  if (worker) return worker
  if (typeof Worker !== 'function') throw new LocalVerificationError('unsupported')

  worker = new Worker(new URL('./local-verifier-worker.js', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (event) => {
    const { id, ok, hash, code } = event.data || {}
    const request = pending.get(id)
    if (!request) return
    pending.delete(id)
    clearTimeout(request.timeout)

    if (ok && typeof hash === 'string' && SHA256_HEX.test(hash)) {
      request.resolve(hash)
      return
    }

    request.reject(new LocalVerificationError(code || 'engine-failure'))
  })
  worker.addEventListener('error', () => resetWorker('engine-failure'))
  worker.addEventListener('messageerror', () => resetWorker('engine-failure'))
  return worker
}

export async function verifyFileLocally(file) {
  let buffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw new LocalVerificationError('read-failure')
  }

  const verifier = getWorker()
  const id = ++requestId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      resetWorker('timeout')
      reject(new LocalVerificationError('timeout'))
    }, VERIFICATION_TIMEOUT_MS)

    pending.set(id, { resolve, reject, timeout })
    try {
      verifier.postMessage({ id, buffer }, [buffer])
    } catch {
      pending.delete(id)
      clearTimeout(timeout)
      reject(new LocalVerificationError('engine-failure'))
    }
  })
}
