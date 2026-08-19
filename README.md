# ProofStamp for Important Files

A privacy-first web app that creates SHA-256 fingerprints for one or more files in the browser and prepares one ProofStamp email.

Files are never uploaded. There is no registration. The app records only aggregate usage counters for completed ProofStamps, email-app opens, and file counts.

## What the app does

- Hashes 1–5 photos, documents, or other files locally with SHA-256
- Keeps an individual fingerprint for every file
- Requires one plain-language description for the ProofStamp
- Sends the prepared email to the user or another recipient, with optional CC
- Opens the user's email app with a complete human-readable ProofStamp
- Downloads or copies the same portable plain-text ProofStamp
- Verifies one file, several selected files, or all files in the ProofStamp
- Explains the evidence value and important limitations

## Run locally

Playwright is used for development and browser tests.

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

### Aggregate metrics setup

The Pages Function at `functions/api/metrics.js` expects a Cloudflare D1 binding named `METRICS_DB`.

1. Create a D1 database, for example `proofstamp-metrics`.
2. In the Pages project, add a D1 binding with variable name `METRICS_DB` for production and preview as needed.
3. Redeploy the Pages project so the binding is available to the Function.

The Function initializes the single aggregate row automatically. `migrations/0001_proofstamp_metrics.sql` contains the same schema for explicit database setup if preferred.

`GET /api/metrics` returns only aggregate values:

- `proofstampsCreated`
- `emailAppOpened`
- `emailOpenRatePct`
- `averageFilesPerProofstamp`

The public `/stats` page renders these values as three simple aggregate metrics. The counters start at zero when the D1 database is first connected. They do not reconstruct historical ProofStamps.

## Privacy and security

All hashing happens through the browser Web Crypto API. Email addresses are used only to construct a local `mailto:` link. They are not stored or sent to the metrics endpoint.

The metrics endpoint receives only one of these payloads:

```json
{ "event": "proof_created", "fileCount": 3 }
```

or:

```json
{ "event": "email_opened" }
```

No file contents, hashes, filenames, descriptions, email addresses, or file metadata are sent to the metrics endpoint. The `email_opened` counter means the user clicked the button to open their email app. It does not prove that an email was sent.

A ProofStamp is practical supporting evidence, not a trusted timestamp. It does not prove when or where a file was created, who created it, whether it was edited before the ProofStamp, or whether its contents are true.

See [docs/architecture.md](docs/architecture.md) for the ProofStamp format and verification model.

## Brand assets

- `public/email-receipt-logo.svg` is the current horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines a minimal envelope with the official PS seal using vector paths only.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo unchanged.

## Automated checks

`npm run check` runs unit tests, builds the production site, and runs Playwright browser tests at a 390×844 mobile viewport. GitHub Actions installs Chromium and runs the same checks for every pull request and every push to `main`.
