# ProofStamp architecture

## Design principle

ProofStamp via Email is intentionally a local utility, not a proof-hosting service.

The core path is:

**file → SHA-256 on the user's device → portable ProofStamp → user chooses where to keep it**

Creating or verifying a ProofStamp must not require an account, login, ProofStamp API, proof database, remote file storage, or a trusted ProofStamp clock.

## Product flow

1. The user takes photos with their normal Camera app or already has files on the device.
2. The user chooses 1–5 important or illustrative photos/files in ProofStamp.
3. Image selections are shown as local thumbnail previews so the user can confirm or remove the wrong files.
4. The browser immediately calculates a SHA-256 fingerprint for each selected file with Web Crypto.
5. The user adds one required description and a destination email.
6. The user can add an optional second recipient.
7. The app creates one portable ProofStamp.
8. The user can:
   - open their email app with the ProofStamp prepared in the message body,
   - copy the ProofStamp,
   - save the ProofStamp as a local text file.
9. In the email app, the user may optionally attach the exact original files before sending.
10. The verification view can check one file, several files, or all files against the fingerprints in the ProofStamp.

If the user is offline, steps 1–8 remain local. Sending the email can happen later.

## Photo selection and previews

ProofStamp does not provide an in-browser camera flow.

The intended field workflow is to use the phone's normal Camera app, where originals are naturally kept in the normal Gallery/Photos library, then choose the strongest 1–5 images for the ProofStamp.

Selected images are previewed with temporary local `blob:` URLs created from the browser `File` objects. These previews never leave the device. Object URLs are revoked when files are removed, the create flow is reset, or the page is left.

Non-image files use a simple file indicator instead of a thumbnail.

## Privacy boundary

File processing remains local to the browser.

- Source files stay on the user's device.
- Files are read only inside the browser for local previews and hashing.
- Email addresses are used only to construct the local `mailto:` URL.
- No file contents, fingerprints, filenames, descriptions, email addresses, or file metadata are sent to ProofStamp.
- No registration, login, cookie-based identity, or proof storage is required.
- The client makes no ProofStamp API request while creating or verifying a proof.
- The production Content Security Policy uses `connect-src 'none'` to prevent client-side fetch, XHR, EventSource, and WebSocket connections.
- Verification workers are restricted to same-origin code with `worker-src 'self'`.
- WebAssembly execution is allowed narrowly with `wasm-unsafe-eval`; ordinary JavaScript `unsafe-eval` is not enabled.

The return-from-email convenience stores the current ProofStamp and delivery fields in `sessionStorage`. This is local, temporary interface state. It is not a proof store, is not sent to ProofStamp, and is not relied on for verification.

## File fingerprints

Every selected file gets its own SHA-256 fingerprint. A multi-file ProofStamp is one description plus a list of individual fingerprints.

Hashing begins automatically after selection. The actual **SHA-256 hash / file fingerprint** remains visible in the ready screen and generated ProofStamp because it is the core proof value, not just an implementation detail.

ProofStamp creation continues to use the browser's Web Crypto SHA-256 implementation. Dual calculation is used only when checking an existing ProofStamp.

## ProofStamp format

The email body, copied ProofStamp, and downloaded ProofStamp use the same human-readable plain-text representation.

Example:

```text
PROOFSTAMP

ProofStamp for: Driveway before concrete removal

VERIFY THE FILES
https://email.proofstamp.org/verify

FILES
1. IMG_7123.jpg · 2.4 MB
SHA-256 hash / file fingerprint: <64 hexadecimal characters>

2. IMG_7124.jpg · 2.1 MB
SHA-256 hash / file fingerprint: <64 hexadecimal characters>

Keep the exact original files. Matching fingerprints later confirm the files have not changed.

The email received time shows when this ProofStamp reached the inbox.

ProofStamp does not prove when or where a file was created, who made it, or whether its contents are true.

No upload. No account. Files stay on your device.

Create a ProofStamp:
https://email.proofstamp.org/
```

Filenames are optional. Delivery addresses are excluded from copied and downloaded ProofStamps.

## Time model

New ProofStamps do not contain a device-generated creation date.

The local device clock is controlled by the user and can be altered, so it must not be presented as timestamp evidence.

If the ProofStamp is sent by email, the receiving mail system's received time can provide a practical external record that the ProofStamp reached that inbox by that time.

The following are useful ways to preserve the attestation but are not treated as trusted timestamps by themselves:

- an unsent email draft,
- copied ProofStamp text,
- a downloaded ProofStamp text file,
- the original file attached to an unsent message,
- device file metadata or device clock values.

## Verification model

When a user pastes a ProofStamp email, the verifier extracts the individual SHA-256 fingerprints.

For each selected file, verification follows this local sequence:

1. The browser reads the file once with `File.arrayBuffer()`.
2. Ownership of that exact byte buffer is transferred to a dedicated module worker.
3. The worker calculates SHA-256 with Web Crypto.
4. The same byte sequence is calculated by a separate RustCrypto `sha2` implementation compiled to WebAssembly. The Rust side receives bounded chunks copied from the transferred buffer into its own linear memory.
5. The two locally calculated hashes must be identical. A disagreement or failure stops verification and is not treated as a normal file mismatch.
6. Only after the two calculations agree is that hash compared with the fingerprint recorded in the ProofStamp.

The Rust verifier source, exact Rust toolchain, exact `sha2` dependency, committed `Cargo.lock`, checksum-pinned rustup installer, and deterministic embed script are part of the repository so the implementation can be audited and rebuilt. Each production or preview build regenerates the verifier from that pinned source. The application does not fetch a WebAssembly binary, cryptographic library, or verification service at runtime.

- One selected file can be checked against any fingerprint in the ProofStamp.
- Several selected files are checked as a multiset, so duplicate fingerprints cannot be reused more times than they appear in the ProofStamp.
- If the number of selected files equals the number of fingerprints and they all match, the selected files match the complete recorded collection.
- Legacy single-file ProofStamps remain valid and can still be verified.

A SHA-256 match shows that the compared byte sequences are identical with extremely high confidence.

The two calculations provide implementation diversity, not two independent trust authorities. Both implementations and the result UI are delivered by the same ProofStamp web application. A fully compromised ProofStamp deployment could therefore subvert both calculations or the displayed result. Dual local verification is intended to detect calculation-path defects or disagreement, not to make the web application itself a separate root of trust.

A match does not establish the original creation time, source, authorship, location, pre-ProofStamp editing history, or truth of the files' contents. Users should retain the exact original files and, when email timing matters, the full received email including headers.

## Deployment

The repository builds the static client to `dist/` with `npm run build`.

`npm run build` runs the fast Node tests, installs the checksum-verified pinned Rust toolchain in an isolated build location, compiles the locked Rust verifier, checks known SHA-256 vectors and agreement with Web Crypto, embeds the generated verifier bytes into the static client, and then creates `dist/`. A failure in any verifier-build step fails the deployment.

Cloudflare Pages serves the resulting static application. No API, database binding, or backend proof service is required. The remaining Pages middleware exists only to set `noindex, nofollow` on Cloudflare preview deployments.

GitHub Actions runs the fuller `npm run check` gate for pull requests and `main`, including Chromium mobile tests and the dual-verification flow in WebKit.

A future service worker may cache the application shell for offline loading. It should cache application assets only, not user files, hashes, descriptions, recipient addresses, or generated ProofStamps.
