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
  assert.doesNotMatch(hardened, /unsafe-inline|unsafe-eval/)
  assert.doesNotMatch(hardened, /https:\/\//)
})

test('CSP helper refuses to modify an unexpected script policy', () => {
  assert.throws(
    () => addScriptHashToCsp("Content-Security-Policy: script-src 'self' https://example.com;", "'sha256-test'"),
    /strict self-only script-src/
  )
})
