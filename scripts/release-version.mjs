export function addReleaseVersion(html, appVersion) {
  return html
    .replace(/<span>ProofStamp(?: · v[0-9.]+)?<\/span>/, `<span>ProofStamp · v${appVersion}</span>`)
    .replace(/(href|src)="(\/[^"?]+\.(?:css|js|svg))(?:\?v=[^"]+)?"/g, `$1="$2?v=${appVersion}"`)
}

export function addModuleReleaseVersion(source, appVersion) {
  const pattern = /export const APP_VERSION = '[^']*'/
  if (!pattern.test(source)) {
    throw new Error('Could not find APP_VERSION in receipt module.')
  }
  return source.replace(pattern, `export const APP_VERSION = '${appVersion}'`)
}
