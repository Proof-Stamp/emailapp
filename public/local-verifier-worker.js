import { dualSha256Bytes } from './dual-hash.js'
import { HashEngineDisagreementError } from './hash-agreement.js'

self.addEventListener('message', async (event) => {
  const { id, buffer } = event.data || {}
  if (!Number.isInteger(id) || !(buffer instanceof ArrayBuffer)) return

  try {
    const hash = await dualSha256Bytes(new Uint8Array(buffer))
    self.postMessage({ id, ok: true, hash })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      code: error instanceof HashEngineDisagreementError ? 'disagreement' : 'engine-failure'
    })
  }
})
