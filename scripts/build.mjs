import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'public')
const destination = resolve(root, 'dist')

const canonicalUrl = 'https://email.proofstamp.org/'
const pageTitle = 'ProofStamp via Email | Private File Timestamp & SHA-256'
const pageDescription = 'Create SHA-256 fingerprints for photos and documents in your browser and email a timestamped ProofStamp. Free, private, no registration, no file uploads.'

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
        url: 'https://email.proofstamp.org/proofstamp-seal.svg'
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
        'Creates one email ProofStamp for one to five files',
        'Verifies files locally without uploading them'
      ]
    }
  ]
}

function addHomeSeo(html) {
  const socialImage = 'https://email.proofstamp.org/proofstamp-email-mark-vector.svg'
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
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>`

  return html
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${pageDescription}" />`
    )
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${pageTitle}</title>`)
    .replace(
      '    <link rel="icon" href="/proofstamp-seal.svg" type="image/svg+xml" />',
      `${seoHead}\n    <link rel="icon" href="/proofstamp-seal.svg" type="image/svg+xml" />`
    )
}

function addStatsRobotsMeta(html) {
  if (html.includes('name="robots"')) return html
  return html.replace(
    '    <meta name="theme-color" content="#071b2c" />',
    '    <meta name="theme-color" content="#071b2c" />\n    <meta name="robots" content="noindex, follow" />'
  )
}

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })

const homePath = resolve(destination, 'index.html')
const statsPath = resolve(destination, 'stats/index.html')

await writeFile(homePath, addHomeSeo(await readFile(homePath, 'utf8')))
await writeFile(statsPath, addStatsRobotsMeta(await readFile(statsPath, 'utf8')))

console.log('Built static site in dist/')
