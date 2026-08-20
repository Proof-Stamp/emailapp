import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { onRequest as previewRobotsMiddleware } from '../functions/_middleware.js'

const robotsPath = new URL('../public/robots.txt', import.meta.url)
const sitemapPath = new URL('../public/sitemap.xml', import.meta.url)
const headersPath = new URL('../public/_headers', import.meta.url)
const buildPath = new URL('../scripts/build.mjs', import.meta.url)

test('crawler files point search engines at the canonical production URL', async () => {
  const [robots, sitemap] = await Promise.all([
    readFile(robotsPath, 'utf8'),
    readFile(sitemapPath, 'utf8')
  ])

  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Sitemap: https:\/\/email\.proofstamp\.org\/sitemap\.xml/)
  assert.doesNotMatch(robots, /\/api\//)
  assert.match(sitemap, /<loc>https:\/\/email\.proofstamp\.org\/<\/loc>/)
  assert.doesNotMatch(sitemap, /\/stats|\/verify|\/api\//)
})

test('verification is excluded from search and runtime network connections are disabled', async () => {
  const headers = await readFile(headersPath, 'utf8')

  assert.match(headers, /\/verify[\s\S]*X-Robots-Tag: noindex, follow/)
  assert.match(headers, /connect-src 'none'/)
  assert.doesNotMatch(headers, /\/stats|\/api\/\*/)
})

test('production build injects canonical, social and structured metadata', async () => {
  const build = await readFile(buildPath, 'utf8')

  assert.match(build, /https:\/\/email\.proofstamp\.org\//)
  assert.match(build, /rel=\\?"canonical\\?"/)
  assert.match(build, /property=\\?"og:title\\?"/)
  assert.match(build, /name=\\?"twitter:card\\?"/)
  assert.match(build, /application\/ld\+json/)
  assert.match(build, /WebApplication/)
  assert.match(build, /https:\/\/proofstamp\.org\/#organization/)
})

test('Cloudflare preview deployments are noindexed without affecting production', async () => {
  const preview = await previewRobotsMiddleware({
    request: new Request('https://seo-hardening.emailapp-9wz.pages.dev/'),
    next: async () => new Response('preview')
  })
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow')

  const production = await previewRobotsMiddleware({
    request: new Request('https://email.proofstamp.org/'),
    next: async () => new Response('production')
  })
  assert.equal(production.headers.get('x-robots-tag'), null)
})
