import { bytesToHex } from './hash.js'
import { RUST_SHA256_WASM_BASE64 } from './rust-sha256-wasm.js'

const CHUNK_SIZE_BYTES = 1024 * 1024
const DIGEST_SIZE_BYTES = 32
let wasmExportsPromise = null

function decodeBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function requireExport(exports, name, type) {
  if (typeof exports[name] !== type) throw new Error(`Invalid local verifier export: ${name}`)
}

async function loadWasmExports() {
  if (!wasmExportsPromise) {
    wasmExportsPromise = WebAssembly.instantiate(decodeBase64(RUST_SHA256_WASM_BASE64), {}).then(({ instance }) => {
      const exports = instance.exports
      if (!(exports.memory instanceof WebAssembly.Memory)) throw new Error('Invalid local verifier memory')
      ;['alloc', 'dealloc', 'sha256_new', 'sha256_update', 'sha256_finalize', 'sha256_free']
        .forEach((name) => requireExport(exports, name, 'function'))
      return exports
    })
  }
  return wasmExportsPromise
}

export async function rustSha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const wasm = await loadWasmExports()
  const chunkCapacity = Math.min(Math.max(input.byteLength, 1), CHUNK_SIZE_BYTES)
  const chunkPointer = wasm.alloc(chunkCapacity)
  const outputPointer = wasm.alloc(DIGEST_SIZE_BYTES)
  let handle = wasm.sha256_new()

  if (!chunkPointer || !outputPointer || !handle) throw new Error('Local verifier allocation failed')

  try {
    for (let offset = 0; offset < input.byteLength; offset += chunkCapacity) {
      const length = Math.min(chunkCapacity, input.byteLength - offset)
      new Uint8Array(wasm.memory.buffer, chunkPointer, length).set(input.subarray(offset, offset + length))
      if (wasm.sha256_update(handle, chunkPointer, length) !== 1) throw new Error('Local verifier update failed')
    }

    const finalizedHandle = handle
    handle = 0
    if (wasm.sha256_finalize(finalizedHandle, outputPointer) !== 1) throw new Error('Local verifier finalization failed')
    const digest = new Uint8Array(wasm.memory.buffer, outputPointer, DIGEST_SIZE_BYTES).slice()
    return bytesToHex(digest)
  } finally {
    if (handle) wasm.sha256_free(handle)
    if (chunkPointer) wasm.dealloc(chunkPointer, chunkCapacity)
    if (outputPointer) wasm.dealloc(outputPointer, DIGEST_SIZE_BYTES)
  }
}
