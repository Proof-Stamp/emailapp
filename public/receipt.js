import { MAX_FILES_PER_PROOFSTAMP, isSha256 } from './hash.js'

export const RECEIPT_SCHEMA = 'org.proofstamp.email-receipt'
export const RECEIPT_VERSION = '2.0'
export const APP_VERSION = '0.3.0'
export const VERIFICATION_URL = 'https://email.proofstamp.org/verify'
export const CREATE_URL = 'https://email.proofstamp.org/'

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function formatReceiptDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const hour24 = date.getUTCHours()
  const hour12 = hour24 % 12 || 12
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const period = hour24 < 12 ? 'AM' : 'PM'

  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} at ${hour12}:${minute} ${period} UTC`
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function normalizeFile(file, includeFilename = true) {
  const hash = String(file?.hash || '').toLowerCase()
  if (!isSha256(hash)) throw new TypeError('Every file needs a valid SHA-256 fingerprint.')

  return {
    hash,
    file_name: includeFilename ? (file.fileName ?? file.file_name ?? null) : null,
    file_size_bytes: Number(file.fileSizeBytes ?? file.file_size_bytes ?? 0),
    media_type: file.mediaType ?? file.media_type ?? 'application/octet-stream'
  }
}

function receiptFiles(receipt) {
  if (Array.isArray(receipt?.files) && receipt.files.length) return receipt.files
  if (isSha256(String(receipt?.hash || ''))) {
    return [{
      hash: receipt.hash.toLowerCase(),
      file_name: receipt.file_name ?? null,
      file_size_bytes: Number(receipt.file_size_bytes || 0),
      media_type: receipt.media_type || 'application/octet-stream'
    }]
  }
  return []
}

export function createReceipt({
  hash,
  description,
  fileName,
  includeFilename = true,
  fileSizeBytes,
  mediaType,
  files,
  setHash = '',
  createdAtDevice = new Date().toISOString()
}) {
  if (!description.trim()) throw new TypeError('A description is required.')

  const sourceFiles = Array.isArray(files) && files.length
    ? files
    : [{ hash, fileName, fileSizeBytes, mediaType }]

  if (!sourceFiles.length || sourceFiles.length > MAX_FILES_PER_PROOFSTAMP) {
    throw new TypeError(`Choose between 1 and ${MAX_FILES_PER_PROOFSTAMP} files.`)
  }

  const normalizedFiles = sourceFiles.map((file) => normalizeFile(file, includeFilename))
  const normalizedSetHash = normalizedFiles.length > 1 ? String(setHash).toLowerCase() : ''
  if (normalizedFiles.length > 1 && !isSha256(normalizedSetHash)) {
    throw new TypeError('A valid set fingerprint is required for multiple files.')
  }

  return {
    schema: RECEIPT_SCHEMA,
    version: RECEIPT_VERSION,
    hash_algorithm: 'SHA-256',
    description: description.trim(),
    files: normalizedFiles,
    set_hash: normalizedSetHash || null,
    created_at_device: createdAtDevice,
    verification_url: VERIFICATION_URL,
    app_version: APP_VERSION
  }
}

export function receiptToText(receipt) {
  const files = receiptFiles(receipt)
  if (!files.length) throw new TypeError('The ProofStamp does not contain any valid files.')

  const plural = files.length > 1
  const lines = [
    'PROOFSTAMP', '',
    `I sent you a ProofStamp for ${receipt.description}.`, '',
    plural
      ? `${files.length} files were fingerprinted. Use this to check whether they match later.`
      : 'Use it to check later whether a file exactly matches the one I fingerprinted.', '',
    plural ? 'VERIFY THE FILES' : 'VERIFY THE FILE',
    receipt.verification_url || VERIFICATION_URL, '',
    'DETAILS'
  ]

  files.forEach((file, index) => {
    const label = file.file_name || `File ${index + 1}`
    lines.push(`${index + 1}. ${label} · ${formatBytes(file.file_size_bytes)}`)
    lines.push(`SHA-256: ${file.hash}`)
    if (index < files.length - 1) lines.push('')
  })

  if (plural && isSha256(String(receipt.set_hash || ''))) {
    lines.push('', 'Set fingerprint (SHA-256):', receipt.set_hash)
  }

  lines.push(
    `Created at: ${formatReceiptDate(receipt.created_at_device)}`, '',
    plural
      ? 'Keep the original files. Matching fingerprints later mean the files have not changed.'
      : 'Keep the original file. A matching fingerprint later means the file has not changed.', '',
    'ABOUT THIS PROOFSTAMP',
    plural
      ? 'Matching fingerprints confirm the files are unchanged. The email received time shows when this ProofStamp reached the inbox.'
      : 'A matching fingerprint confirms the file is unchanged. The email received time shows when this ProofStamp reached the inbox.', '',
    `Free. Private. No registration. Your ${plural ? 'files stay' : 'file stays'} on your device.`, '',
    `ProofStamp your own ${plural ? 'files' : 'file'} →`,
    CREATE_URL
  )

  return lines.join('\n')
}

function encodeMailtoBody(text) {
  const withCrlf = text.replace(/\r\n|\r|\n/g, '\r\n')
  return encodeURIComponent(withCrlf)
}

export function createMailtoUrl({ receipt, primaryEmail, secondEmail = '' }) {
  if (!isValidEmail(primaryEmail)) throw new TypeError('A valid primary email is required.')
  if (secondEmail && !isValidEmail(secondEmail)) throw new TypeError('The second email is invalid.')

  const subject = `ProofStamp: ${receipt.description.slice(0, 80)}`
  const params = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeMailtoBody(receiptToText(receipt))}`
  ]
  if (secondEmail) params.push(`cc=${encodeURIComponent(secondEmail)}`)
  return `mailto:${encodeURIComponent(primaryEmail)}?${params.join('&')}`
}

export function parseReceiptJson(text) {
  const parsed = JSON.parse(text)
  if (parsed?.schema !== RECEIPT_SCHEMA || parsed?.hash_algorithm !== 'SHA-256') {
    throw new TypeError('Invalid ProofStamp file.')
  }

  if (Array.isArray(parsed.files) && parsed.files.length) {
    if (parsed.files.length > MAX_FILES_PER_PROOFSTAMP) throw new TypeError('Invalid ProofStamp file.')
    const files = parsed.files.map((file) => normalizeFile(file, true))
    if (files.length > 1 && !isSha256(String(parsed.set_hash || ''))) {
      throw new TypeError('Invalid ProofStamp file.')
    }
    return {
      ...parsed,
      files,
      set_hash: parsed.set_hash ? String(parsed.set_hash).toLowerCase() : null
    }
  }

  if (!isSha256(String(parsed?.hash || ''))) throw new TypeError('Invalid ProofStamp file.')
  return { ...parsed, hash: parsed.hash.toLowerCase() }
}
