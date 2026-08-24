export class LocalVerificationError extends Error {
  constructor(code) {
    super(`Local verification failed: ${code}`)
    this.name = 'LocalVerificationError'
    this.code = code
  }
}

let worker = null
let requestId = 0
const pending = new Map()

function rejectPending(code) {
  pending.forEach(({ reject }) => reject(new LocalVerificationError(code)))
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
    if (ok) request.resolve(hash)
    else request.reject(new LocalVerificationError(code || 'engine-failure'))
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
    pending.set(id, { resolve, reject })
    try {
      verifier.postMessage({ id, buffer }, [buffer])
    } catch {
      pending.delete(id)
      reject(new LocalVerificationError('engine-failure'))
    }
  })
}
