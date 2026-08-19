import { isSha256 } from './hash.js'

export const RECEIPT_SCHEMA = 'org.proofstamp.email-receipt'
export const RECEIPT_VERSION = '1.0'
export const APP_VERSION = '0.2.0'
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

export function createReceipt({
  hash,
  description,
  fileName,
  includeFilename,
  fileSizeBytes,
  mediaType,
  createdAtDevice = new Date().toISOString()
}) {
  if (!isSha256(hash)) throw new TypeError('A valid SHA-256 fingerprint is required.')
  if (!description.trim()) throw new TypeError('A description is required.')

  return {
    schema: RECEIPT_SCHEMA,
    version: RECEIPT_VERSION,
    hash_algorithm: 'SHA-256',
    hash: hash.toLowerCase(),
    description: description.trim(),
    file_name: includeFilename ? fileName : null,
    file_size_bytes: fileSizeBytes,
    media_type: mediaType || 'application/octet-stream',
    created_at_device: createdAtDevice,
    verification_url: VERIFICATION_URL,
    app_version: APP_VERSION
  }
}

export function receiptToText(receipt) {
  const lines = [
    'PROOFSTAMP', '',
    'I sent you a ProofStamp',
    `For: ${receipt.description}`, '',
    'This record lets you later check whether a file is identical to the one used to create this fingerprint.', '',
    'VERIFY A FILE',
    receipt.verification_url, '',
    'PROOFSTAMP DETAILS',
    ...(receipt.file_name ? [`Filename: ${receipt.file_name}`] : []),
    `File size: ${formatBytes(receipt.file_size_bytes)} (${receipt.file_size_bytes} bytes)`,
    'SHA-256 fingerprint:',
    receipt.hash,
    `Created on this device: ${formatReceiptDate(receipt.created_at_device)}`, '',
    'Keep the original file. If its SHA-256 fingerprint matches this ProofStamp later, the file contents have not changed.', '',
    'WHAT THIS DOES NOT PROVE',
    'A ProofStamp does not prove when or where the file was originally created, who made it, whether it was edited before the ProofStamp, or whether its contents are true. The received time on this email records when this ProofStamp reached the inbox.', '',
    'Need to create your own?',
    `ProofStamp a file: ${CREATE_URL}`
  ]
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
  if (
    parsed?.schema !== RECEIPT_SCHEMA ||
    parsed?.hash_algorithm !== 'SHA-256' ||
    !isSha256(String(parsed?.hash || ''))
  ) {
    throw new TypeError('Invalid ProofStamp file.')
  }
  return { ...parsed, hash: parsed.hash.toLowerCase() }
}
