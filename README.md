# ProofStamp for Important Files

A privacy-first web app that creates SHA-256 fingerprints for one or more files in the browser and prepares one ProofStamp email.

The files are never uploaded. The app has no registration, backend, analytics, or external service dependency.

## What the app does

- Hashes 1–10 photos, documents, or other files locally with SHA-256
- Keeps an individual fingerprint for every file
- Requires one plain-language description for the ProofStamp
- Sends the prepared email to the user or another recipient, with optional CC
- Opens the user's email app with a complete human-readable ProofStamp
- Downloads or copies the same portable plain-text ProofStamp
- Verifies one file, several selected files, or all files in the ProofStamp
- Explains the evidence value and important limitations

## Run locally

The app is static and has no runtime dependencies. Playwright is used only for development and browser tests.

```bash
npm install
npx playwright install chromium
npm run check
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

See [docs/architecture.md](docs/architecture.md) for the ProofStamp format and verification model.

## Brand assets

- `public/email-receipt-logo.svg` is the current horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines a minimal envelope with the official PS seal using vector paths only.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo unchanged.

## Automated checks

`npm run check` runs unit tests, builds the production site, and runs Playwright browser tests at a 390×844 mobile viewport. GitHub Actions installs Chromium and runs the same checks for every pull request and every push to `main`.
