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
