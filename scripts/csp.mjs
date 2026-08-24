import { createHash } from 'node:crypto'

export function sha256CspSource(text) {
  const digest = createHash('sha256').update(text, 'utf8').digest('base64')
  return `'sha256-${digest}'`
}

export function addScriptHashToCsp(headers, scriptHash) {
  const match = headers.match(/script-src\s+([^;]+);/)
  if (!match) throw new Error('Expected a script-src directive before adding the JSON-LD hash.')

  const sources = match[1].trim().split(/\s+/)
  const allowed = new Set(["'self'", "'wasm-unsafe-eval'"])
  const safe = sources.includes("'self'") && sources.every((source) => allowed.has(source))
  if (!safe) {
    throw new Error('Expected a strict local script-src directive before adding the JSON-LD hash.')
  }

  const original = match[0]
  const hardened = `script-src ${sources.join(' ')} ${scriptHash};`
  return headers.replace(original, hardened)
}
