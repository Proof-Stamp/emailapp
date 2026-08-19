# SEO and indexing

Production canonical URL: `https://email.proofstamp.org/`

## What is indexed

Only the main app homepage is intended to appear in search results. The build adds a self-referencing canonical, descriptive title and meta description, Open Graph/Twitter metadata, and Schema.org data connecting **ProofStamp via Email** to **ProofStamp.org**.

`/verify`, `/stats`, and `/api/*` are utility routes and should not appear in search results. Cloudflare `*.pages.dev` deployments are also sent `X-Robots-Tag: noindex, nofollow` so preview URLs do not compete with production.

## Crawl files

- `https://email.proofstamp.org/robots.txt`
- `https://email.proofstamp.org/sitemap.xml`

The sitemap intentionally lists only `https://email.proofstamp.org/`.

## After production deployment

1. Verify the production homepage source contains the canonical URL and JSON-LD.
2. Verify `/robots.txt` and `/sitemap.xml` return HTTP 200.
3. Add the `email.proofstamp.org` property in Google Search Console.
4. Submit `https://email.proofstamp.org/sitemap.xml`.
5. Request indexing for `https://email.proofstamp.org/`.
6. Keep a normal crawlable link to the tool from `https://proofstamp.org/` and relevant ProofStamp.org articles. The main WordPress site is the strongest first-party signal that this subdomain is an official ProofStamp tool.
