# ProofStamp for Important Files

A privacy-first web app that creates a SHA-256 fingerprint for a file in the browser and prepares a ProofStamp email addressed to the user.

The file is never uploaded. The app has no account system, backend, analytics, or external service dependency.

## What the MVP does

- Hashes photos, documents, and other files locally with SHA-256
- Requires a plain-language description
- Addresses the ProofStamp email to the user
- Recommends an optional second mailbox, preferably at another provider
- Opens the user's email app with a complete ProofStamp
- Downloads a portable plain-text ProofStamp
- Verifies a preserved file against a fingerprint or full ProofStamp email
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

A ProofStamp is practical supporting evidence, not a trusted timestamp. It does not prove when or where a file was created, who created it, whether it was edited before the ProofStamp, or whether its contents are true.

See [docs/architecture.md](docs/architecture.md) for the ProofStamp format and design decisions.

## Brand assets

- `public/email-receipt-logo.svg` is the current horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines a minimal envelope with the official PS seal using vector paths only.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo unchanged.

Legacy duplicate asset names were removed to keep one canonical file for each logo variant.

## Automated checks

`npm run check` runs the unit tests and production build. GitHub Actions runs the same command for every pull request and every push to `main`.
