# ProofStamp via Email

A privacy-first local web utility that creates SHA-256 hashes for one or more files in the browser and prepares a portable ProofStamp that the user can email, copy, or save.

The core create and verify flows do not require a ProofStamp account, proof database, file upload, analytics endpoint, or external API. The user's device reads the file and performs the SHA-256 calculation locally.

## What the app does

- Hashes 1–5 photos, documents, or other files locally with SHA-256
- Provides a prominent mobile **Take photo** path plus regular file selection
- Automatically calculates the SHA-256 hash after files are selected
- Shows the actual **SHA-256 hash / file fingerprint** in the ready screen and generated ProofStamp
- Keeps an individual fingerprint for every file
- Requires one plain-language description for the ProofStamp
- Prepares an email to the user or another recipient, with optional CC
- Lets the user copy or save the same portable plain-text ProofStamp
- Lets the user optionally attach the exact original files in their own email app
- Verifies one file, several selected files, or all files in a ProofStamp locally

## Trust boundary

ProofStamp is intentionally not a trusted intermediary.

- Source files stay on the user's device.
- Files are read only inside the browser for hashing.
- Email addresses are used only to construct a local `mailto:` URL.
- Creating or checking a ProofStamp requires no ProofStamp API call.
- New ProofStamps do not include a device-generated creation date as evidence.
- Local `sessionStorage` is used only to preserve the current screen across the email-app handoff.

The email provider's received time can provide a practical external record of when the ProofStamp reached that inbox. ProofStamp itself does not claim to provide a trusted timestamp.

## Camera photos

A browser camera capture is not guaranteed to appear in the device's Gallery/Photos app. When a photo was captured through the ProofStamp camera path, the UI warns the user to preserve the exact original and offers a local **Save photo** action.

No ProofStamp server receives that photo.

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

The project is a static client. The only Cloudflare Pages Function currently retained is preview robots middleware so non-production preview deployments can be marked `noindex`.

## Verification model

Each file gets a SHA-256 hash. In the product copy this is also called the **file fingerprint** so the user can understand what value is being preserved.

A matching SHA-256 fingerprint shows that two sequences of bytes are identical with extremely high confidence. It does not independently establish original creation time, source, authorship, location, pre-ProofStamp editing history, or truth of the file's contents.

Users should retain the exact original files and, when evidence quality matters, the full email including headers.

See [docs/architecture.md](docs/architecture.md) for the format and verification model.

## Brand assets

- `public/email-receipt-logo.svg` is the horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines a minimal envelope with the official PS seal using vector paths.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo.

## Automated checks

`npm run check` runs unit tests, builds the production site, and runs Playwright browser tests. The mobile suite covers the 390×844 field-oriented flow, automatic hashing, validation, camera preservation guidance, visible SHA-256 fingerprint output, and large touch targets.
