import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'

const CANONICAL = 'https://email.proofstamp.org/'
const { version: APP_VERSION } = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))

test.describe('technical SEO and release metadata', () => {
  test('homepage exposes canonical, social and ProofStamp entity metadata', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('ProofStamp via Email | Timestamp Photos & Documents Privately')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', CANONICAL)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /SHA-256 fingerprints for photos and documents/)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', CANONICAL)
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'ProofStamp')
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary')

    const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
    const types = jsonLd['@graph'].map((item) => item['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('WebApplication')

    const app = jsonLd['@graph'].find((item) => item['@type'] === 'WebApplication')
    expect(app.name).toBe('ProofStamp via Email')
    expect(app.url).toBe(CANONICAL)
    expect(app.publisher['@id']).toBe('https://proofstamp.org/#organization')
    expect(app.isAccessibleForFree).toBe(true)
  })

  test('build exposes the current version and cache-busts static entry assets', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.site-footer > span')).toHaveText(`ProofStamp · v${APP_VERSION}`)
    await expect(page.locator('script[src^="/app.js"]')).toHaveAttribute('src', `/app.js?v=${APP_VERSION}`)
    await expect(page.locator('link[href^="/styles.css"]')).toHaveAttribute('href', `/styles.css?v=${APP_VERSION}`)

    await page.goto('/stats')
    await expect(page.locator('.site-footer > span')).toHaveText(`ProofStamp · v${APP_VERSION}`)
    await expect(page.locator('script[src^="/stats.js"]')).toHaveAttribute('src', `/stats.js?v=${APP_VERSION}`)
  })

  test('sitemap contains only the canonical homepage and stats is noindex', async ({ page, request }) => {
    const robots = await request.get('/robots.txt')
    expect(await robots.text()).toContain('Sitemap: https://email.proofstamp.org/sitemap.xml')

    const sitemap = await request.get('/sitemap.xml')
    const sitemapText = await sitemap.text()
    expect(sitemapText).toContain('<loc>https://email.proofstamp.org/</loc>')
    expect(sitemapText).not.toContain('/stats')
    expect(sitemapText).not.toContain('/verify')

    await page.goto('/stats')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  })
})
