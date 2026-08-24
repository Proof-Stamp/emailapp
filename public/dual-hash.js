import { sha256Bytes } from './hash.js'
import { assertHashesAgree } from './hash-agreement.js'
import { rustSha256Bytes } from './rust-sha256.js'

export async function dualSha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const [browserHash, independentHash] = await Promise.all([
    sha256Bytes(input),
    rustSha256Bytes(input)
  ])
  return assertHashesAgree(browserHash, independentHash)
}
