import { isSha256 } from './hash.js'

export const RECEIPT_SCHEMA = 'org.proofstamp.email-receipt'
export const RECEIPT_VERSION = '1.0'
export const APP_VERSION = '0.1.0'
export const VERIFICATION_URL = 'https://email.proofstamp.org/verify'

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
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
    'This ProofStamp stores a unique fingerprint for the file described below.', '',
    `Description: ${receipt.description}`,
    ...(receipt.file_name ? [`Filename: ${receipt.file_name}`] : []),
    `File size: ${formatBytes(receipt.file_size_bytes)} (${receipt.file_size_bytes} bytes)`,
    `Media type: ${receipt.media_type}`,
    `File fingerprint (SHA-256): ${receipt.hash}`,
    `ProofStamp created on this device: ${receipt.created_at_device}`, '',
    `Check this file later: ${receipt.verification_url}`, '',
    'Keep the original file. If its fingerprint matches this ProofStamp later, the file has not changed.', '',
    'WHAT A PROOFSTAMP DOES NOT PROVE',
    'It does not prove when or where the file was originally created, who made it, whether it was edited before the ProofStamp, or whether its contents are true. The email received time records when the ProofStamp reached your inbox.'
  ]
  return lines.join('\n')
}

export function createMailtoUrl({ receipt, primaryEmail, secondEmail = '' }) {
  if (!isValidEmail(primaryEmail)) throw new TypeError('A valid primary email is required.')
  if (secondEmail && !isValidEmail(secondEmail)) throw new TypeError('The second email is invalid.')

  const subject = `ProofStamp: ${receipt.description.slice(0, 80)}`
  const params = new URLSearchParams({ subject, body: receiptToText(receipt) })
  if (secondEmail) params.set('cc', secondEmail)
  return `mailto:${encodeURIComponent(primaryEmail)}?${params.toString()}`
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
