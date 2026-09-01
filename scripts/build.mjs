import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { addScriptHashToCsp, sha256CspSource } from './csp.mjs'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'public')
const destination = resolve(root, 'dist')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const appVersion = packageJson.version

const canonicalUrl = 'https://email.proofstamp.org/'
const pageTitle = 'ProofStamp via Email | ProofStamp Photos & Files Privately'
const pageDescription = 'ProofStamp photos and files privately on your device, then email, copy, or save the ProofStamp. No upload, no account, no registration.'

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://proofstamp.org/#organization',
      name: 'ProofStamp',
      url: 'https://proofstamp.org/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://email.proofstamp.org/brand/proofstamp-icon.svg'
      }
    },
    {
      '@type': 'WebSite',
      '@id': 'https://email.proofstamp.org/#website',
      url: canonicalUrl,
      name: 'ProofStamp via Email',
      publisher: { '@id': 'https://proofstamp.org/#organization' }
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://email.proofstamp.org/#webapp',
      name: 'ProofStamp via Email',
      url: canonicalUrl,
      description: pageDescription,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      isPartOf: { '@id': 'https://email.proofstamp.org/#website' },
      publisher: { '@id': 'https://proofstamp.org/#organization' },
      featureList: [
        'Creates SHA-256 file fingerprints in the browser',
        'Prepares a portable ProofStamp for email, copy, or download',
        'Verifies files locally without uploading them'
      ]
    }
  ]
}

const jsonLdText = JSON.stringify(structuredData)
const jsonLdCspHash = sha256CspSource(jsonLdText)

function addHomeSeo(html) {
  const socialImage = 'https://email.proofstamp.org/brand/proofstamp-wordmark-blue.svg'
  const seoHead = `    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ProofStamp" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${socialImage}" />
    <meta property="og:image:alt" content="ProofStamp via email" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${pageDescription}" />
    <meta name="twitter:image" content="${socialImage}" />
    <script type="application/ld+json">${jsonLdText}</script>`

  return html
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${pageDescription}" />`
    )
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${pageTitle}</title>`)
    .replace(
      /    <link rel="icon" href="\/brand\/proofstamp-icon\.svg(?:\?v=[^"]+)?" type="image\/svg\+xml" \/>/,
      `${seoHead}\n    <link rel="icon" href="/brand/proofstamp-icon.svg" type="image/svg+xml" />`
    )
}

function addReleaseVersion(html) {
  return html
    .replace(/<span>ProofStamp(?: · v[0-9.]+)?<\/span>/, `<span>ProofStamp · v${appVersion}</span>`)
    .replace(/(href|src)="(\/[^"?]+\.(?:css|js|svg))(?:\?v=[^"]+)?"/g, `$1="$2?v=${appVersion}"`)
}

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })

const homePath = resolve(destination, 'index.html')
const homeHtml = addReleaseVersion(addHomeSeo(await readFile(homePath, 'utf8')))
await writeFile(homePath, homeHtml)

// Cloudflare Pages serves /verify from verify.html without changing the URL.
// This avoids the old SPA/root rewrite and gives the verifier a real route.
await writeFile(resolve(destination, 'verify.html'), homeHtml)

const headersPath = resolve(destination, '_headers')
const headers = await readFile(headersPath, 'utf8')
await writeFile(headersPath, addScriptHashToCsp(headers, jsonLdCspHash))

console.log(`Built static site in dist/ (v${appVersion})`)
