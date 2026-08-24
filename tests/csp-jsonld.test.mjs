import assert from 'node:assert/strict'
import test from 'node:test'
import { addScriptHashToCsp, sha256CspSource } from '../scripts/csp.mjs'

test('JSON-LD gets an exact SHA-256 CSP source without weakening script policy', () => {
  const inlineJsonLd = '{"@context":"https://schema.org","@type":"WebApplication"}'
  const hash = sha256CspSource(inlineJsonLd)

  assert.match(hash, /^'sha256-[A-Za-z0-9+/]+={0,2}'$/)

  const headers = "Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'"
  const hardened = addScriptHashToCsp(headers, hash)

  assert.match(hardened, new RegExp(`script-src 'self' ${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`))
  assert.match(hardened, /connect-src 'none'/)
  assert.doesNotMatch(hardened, /unsafe-inline/)
  assert.doesNotMatch(hardened, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/)
  assert.doesNotMatch(hardened, /https:\/\//)
})

test('JSON-LD hash preserves the narrow WebAssembly execution source', () => {
  const hash = "'sha256-test'"
  const headers = "Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'"
  const hardened = addScriptHashToCsp(headers, hash)

  assert.match(hardened, /script-src 'self' 'wasm-unsafe-eval' 'sha256-test';/)
  assert.doesNotMatch(hardened, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/)
})

test('CSP helper refuses to modify an unexpected script policy', () => {
  assert.throws(
    () => addScriptHashToCsp("Content-Security-Policy: script-src 'self' https://example.com;", "'sha256-test'"),
    /strict local script-src/
  )
})
