# ProofStamp via Email

A privacy-first local web utility that creates SHA-256 hashes for one or more files in the browser and prepares a portable ProofStamp that the user can email, copy, or save.

The core create and verify flows do not require a ProofStamp account, proof database, file upload, analytics endpoint, or external API. The user's device reads the file and performs the SHA-256 calculation locally.

## What the app does

- Hashes 1–5 photos, documents, or other files locally with SHA-256
- Lets users choose the most useful photos or files from their device rather than taking photos inside ProofStamp
- Shows local thumbnail previews for selected images so users can confirm or remove the wrong photo before creating the ProofStamp
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
- Files are read only inside the browser for previewing and hashing.
- Image previews use temporary local browser data. They are not uploaded.
- Email addresses are used only to construct a local `mailto:` URL.
- Creating or checking a ProofStamp requires no ProofStamp API call.
- New ProofStamps do not include a device-generated creation date as evidence.
- Local `sessionStorage` is used only to preserve the current screen across the email-app handoff.

The email provider's received time can provide a practical external record of when the ProofStamp reached that inbox. ProofStamp itself does not claim to provide a trusted timestamp.

## Mobile picker behavior

On Android and other phones, the system file picker may offer Camera, Video, Recorder, Photos & videos, Files, My Files, Documents, or Browse. ProofStamp does not control the order of those system choices.

The create screen therefore explains how to reach both the photo gallery and documents. ProofStamp records when the picker opens. If an image, video, or audio file comes back with a `lastModified` time from that picker session, it is treated as a likely fresh Camera/Video/Recorder capture and gets a local **Save original copy** action. Existing gallery media with older timestamps and documents do not get that warning.

Browsers do not expose the actual picker source, so this is intentionally a heuristic rather than a provenance claim. When the warning appears, its save action receives focus before Description. After the local save starts, focus moves to Description and the normal ProofStamp flow continues.

That safety copy is local. It is not uploaded to ProofStamp and is not proof or timestamp evidence by itself.

## Photo workflow

For field use, the intended flow is simple:

1. Take photos with the phone's normal Camera app when practical.
2. Review them in the normal Gallery/Photos app.
3. Choose up to five important or illustrative photos in ProofStamp.
4. Confirm the selected images from the local thumbnail previews.
5. Remove or add files as needed, then continue.

The system picker can still expose Camera/Video/Recorder. When ProofStamp detects media that looks newly created during that picker session, use **Save original copy** before leaving if the phone has not saved it elsewhere.

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

`npm run build` runs the Node unit/security/version tests before generating `dist`. That means a Cloudflare preview deployment fails if those tests fail. The project remains a static client. The only Cloudflare Pages Function currently retained is preview robots middleware so non-production preview deployments can be marked `noindex`.

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

`npm test` runs the fast Node unit/security/version suite. Cloudflare runs this suite automatically as part of every `npm run build` before it deploys a preview.

`npm run check` runs the fast suite, builds the production site, and then runs Playwright browser tests. The mobile suite covers the 390×844 field-oriented flow, automatic hashing, local thumbnail previews, picker guidance, fresh-capture preservation, focus handling, downloads, validation, visible SHA-256 fingerprint output, and large touch targets. GitHub Actions runs this full check on pushes to `main` and can also be started manually while the GitHub-hosted PR runner issue is unresolved.
