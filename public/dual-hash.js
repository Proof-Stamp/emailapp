import { sha256Bytes } from './hash.js'
import { rustSha256Bytes } from './rust-sha256.js'

export class HashEngineDisagreementError extends Error {
  constructor() {
    super('Local SHA-256 implementations disagreed')
    this.name = 'HashEngineDisagreementError'
  }
}

export function assertHashesAgree(first, second) {
  if (first !== second) throw new HashEngineDisagreementError()
  return first
}

export async function dualSha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const [browserHash, independentHash] = await Promise.all([
    sha256Bytes(input),
    rustSha256Bytes(input)
  ])
  return assertHashesAgree(browserHash, independentHash)
}
