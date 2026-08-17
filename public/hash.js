export const HASH_ALGORITHM = 'SHA-256'
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, input)
  return bytesToHex(new Uint8Array(digest))
}

export async function sha256File(file) {
  return sha256Bytes(await file.arrayBuffer())
}

export function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(value.trim())
}

export function extractSha256(value) {
  const match = value.match(/\b[a-f0-9]{64}\b/i)
  return match ? match[0].toLowerCase() : ''
}
