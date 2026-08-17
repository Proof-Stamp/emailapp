# ProofStamp Email Receipt

A privacy-first web app that creates a SHA-256 fingerprint for a file in the browser and prepares an email receipt addressed to the user.

The file is never uploaded. The app has no account system, backend, analytics, or blockchain dependency.

## What the MVP does

- Hashes photos, documents, and other files locally with SHA-256
- Requires a plain-language description
- Addresses the receipt to the user's own email
- Recommends an optional second mailbox, preferably at another provider
- Opens the user's email app with a complete text receipt
- Exports a portable JSON receipt
- Verifies a preserved file against an emailed hash or JSON receipt
- Explains the evidence value and important limitations

## Run locally

The app is static and has no runtime dependencies.

```bash
npm test
npm run build
npx serve public
```

Open the local URL shown by `serve`.

## Deploy

For Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`

Point `email.proofstamp.org` to the resulting Pages project after deployment.

## Privacy and security

All hashing happens through the browser Web Crypto API. Email addresses are used only to construct a local `mailto:` link. They are not stored or transmitted by this app.

This receipt is practical supporting evidence, not a trusted timestamp. It does not prove when or where a file was created, who created it, whether it was edited before the receipt, or whether its contents are true.

See [docs/architecture.md](docs/architecture.md) for the receipt schema and design decisions.

## Brand assets

- `public/email-receipt-logo.svg` is the current horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines a minimal envelope with the official PS seal using vector paths only.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo unchanged.
- `public/icon.svg` is the browser favicon.
