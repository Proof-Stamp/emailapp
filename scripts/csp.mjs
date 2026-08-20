import { createHash } from 'node:crypto'

export function sha256CspSource(text) {
  const digest = createHash('sha256').update(text, 'utf8').digest('base64')
  return `'sha256-${digest}'`
}

export function addScriptHashToCsp(headers, scriptHash) {
  const needle = "script-src 'self';"
  if (!headers.includes(needle)) {
    throw new Error('Expected a strict self-only script-src directive before adding the JSON-LD hash.')
  }

  return headers.replace(needle, `script-src 'self' ${scriptHash};`)
}
