# ProofStamp via Email

A privacy-first web utility that creates SHA-256 fingerprints for photos and files on the user's device and prepares a portable ProofStamp.

The core model is deliberately small:

**file → SHA-256 on this device → ProofStamp → email, copy, or save**

No account is required. Files are not uploaded. Creating and checking a ProofStamp does not call a ProofStamp API or store proof data on a server.

## What the app does

- Takes a photo or selects 1–5 existing photos, documents, or other files
- Hashes every file locally with the browser Web Crypto API
- Starts hashing automatically after selection
- Keeps an individual SHA-256 fingerprint for every file
- Adds one plain-language description and a destination email
- Opens the user's email app with a human-readable ProofStamp
- Lets the user copy or download the same portable plain-text ProofStamp
- Lets the user optionally attach the exact original files in their own email app
- Verifies one file, several files, or all files locally

## Camera capture

On supported mobile browsers, **Take photo** requests the outward-facing camera with a standard HTML file input.

A photo captured from a browser is not guaranteed to appear in the device's normal Gallery or Photos library. ProofStamp therefore warns the user and offers **Save photo** to download an exact local copy. The original bytes matter because later verification requires the exact original file.

`capture="environment"` is progressive enhancement. **Choose files** remains available when direct camera capture is unsupported or undesirable.

## Time evidence

A ProofStamp does not create or claim a trusted timestamp itself.

New ProofStamps deliberately do not include a device-generated creation date because the device clock is controlled by the user and can be changed.

When the user sends the ProofStamp by email, the receiving mail system's received time can provide a practical external record that the ProofStamp reached that inbox by that time.

An unsent draft, copied ProofStamp, downloaded ProofStamp, attached original file, or device clock is not treated as trusted timestamp evidence.

## Offline behavior

Hashing, ProofStamp creation, copying, downloading, and verification are local operations and do not require a ProofStamp backend.

If the device has no internet connection, the user can still create the ProofStamp and copy or save it. Their email app may also preserve a draft for sending later, depending on the email client.

The current version does not yet include a service worker/offline app shell. That can be added later without introducing proof storage or synchronization.

## Privacy and security

The core create/check flow is designed to have a minimal trust surface:

- Source files stay on the user's device.
- Hashing uses the browser Web Crypto API.
- Email addresses are used only to construct a local `mailto:` URL.
- ProofStamp does not send file contents, fingerprints, filenames, descriptions, recipient addresses, or file metadata to a backend.
- There is no account, login, cookie-based identity, proof database, or metrics API.
- The production security policy sets `connect-src 'none'`, preventing client-side fetch/XHR/WebSocket connections.
- Temporary return-from-email state uses `sessionStorage` only so the current ProofStamp can remain visible when the user comes back from their mail app. It is not part of the proof and is not sent to ProofStamp.

A ProofStamp is supporting evidence, not proof of truth. It does not establish when or where a file was originally created, who created it, whether it was edited before the ProofStamp, or whether its contents are true.

See [docs/architecture.md](docs/architecture.md) for the ProofStamp format and verification model.

## Run locally

Playwright is used for browser tests.

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

The only Cloudflare Function retained is preview-deployment middleware that prevents preview URLs from being indexed. The ProofStamp create and verify flows do not depend on a Function or API.

## Brand assets

- `public/email-receipt-logo.svg` is the horizontal product logo.
- `public/proofstamp-email-mark-vector.svg` combines the envelope with the PS seal using vector paths.
- `public/proofstamp-seal.svg` preserves the official ProofStamp logo.

## Automated checks

`npm run check` runs unit tests, builds the production site, and runs Playwright browser tests at a 390×844 mobile viewport.

The mobile suite covers automatic hashing, incremental file selection, camera-capture guidance, validation/focus behavior, email/copy/save completion, zero application API requests, verification, clipboard fallback, and minimum touch-target sizing.
