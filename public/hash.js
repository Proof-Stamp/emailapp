export const HASH_ALGORITHM = 'SHA-256'
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
export const MAX_FILES_PER_PROOFSTAMP = 10

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
  return /^[a-f0-9]{64}$/i.test(String(value).trim())
}

export function extractSha256(value) {
  const match = String(value).match(/\b[a-f0-9]{64}\b/i)
  return match ? match[0].toLowerCase() : ''
}

export function extractSha256s(value) {
  return Array.from(String(value).matchAll(/\b[a-f0-9]{64}\b/ig), (match) => match[0].toLowerCase())
}

export function extractProofstampFileHashes(value) {
  const text = String(value).trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed?.files)) {
      return parsed.files
        .map((file) => String(file?.hash || '').toLowerCase())
        .filter(isSha256)
    }
    if (isSha256(String(parsed?.hash || ''))) return [String(parsed.hash).toLowerCase()]
  } catch {
    // Human-readable ProofStamp or a raw fingerprint.
  }

  const matches = []
  const patterns = [
    /SHA-256 fingerprint:\s*([a-f0-9]{64})/ig,
    /File fingerprint \(SHA-256\):\s*([a-f0-9]{64})/ig,
    /SHA-256:\s*([a-f0-9]{64})/ig
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) matches.push(match[1].toLowerCase())
  }

  return matches.length ? matches : extractSha256s(text)
}
