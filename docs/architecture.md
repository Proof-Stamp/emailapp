# ProofStamp architecture

## Design principle

ProofStamp via Email is intentionally a local utility, not a proof-hosting service.

The core path is:

**file → SHA-256 on the user's device → portable ProofStamp → user chooses where to keep it**

Creating or verifying a ProofStamp must not require an account, login, ProofStamp API, proof database, remote file storage, or a trusted ProofStamp clock.

## Product flow

1. The user takes a photo or selects 1–5 existing files.
2. The browser immediately calculates a SHA-256 fingerprint for each file with Web Crypto.
3. The user adds one required description and a destination email.
4. The user can add an optional second recipient.
5. The app creates one portable ProofStamp.
6. The user can:
   - open their email app with the ProofStamp prepared in the message body,
   - copy the ProofStamp,
   - save the ProofStamp as a local text file.
7. In the email app, the user may optionally attach the exact original files before sending.
8. The verification view can check one file, several files, or all files against the fingerprints in the ProofStamp.

If the user is offline, steps 1–6 remain local. Sending the email can happen later.

## Camera capture and preserving originals

On supported mobile browsers, the **Take photo** control uses a standard file input with `accept="image/*"` and `capture="environment"`.

The browser gives ProofStamp a `File` object containing the captured bytes. The platform does not guarantee that this camera-created file will also be saved into the user's Gallery or Photos library.

For that reason, the UI warns users to preserve the original and offers **Save photo**, which downloads the exact captured file locally. Verification later requires the exact original bytes.

Direct camera capture is progressive enhancement. The generic **Choose files** path remains available.

## Privacy boundary

File processing remains local to the browser.

- Source files stay on the user's device.
- Files are read only inside the browser for hashing.
- Email addresses are used only to construct the local `mailto:` URL.
- No file contents, fingerprints, filenames, descriptions, email addresses, or file metadata are sent to ProofStamp.
- No registration, login, cookie-based identity, or proof storage is required.
- The client makes no ProofStamp API request while creating or verifying a proof.
- The production Content Security Policy uses `connect-src 'none'` to prevent client-side fetch, XHR, EventSource, and WebSocket connections.

The return-from-email convenience stores the current ProofStamp and delivery fields in `sessionStorage`. This is local, temporary interface state. It is not a proof store, is not sent to ProofStamp, and is not relied on for verification.

## File fingerprints

Every selected file gets its own SHA-256 fingerprint. A multi-file ProofStamp is one description plus a list of individual fingerprints.

Hashing begins automatically after selection. SHA-256 is an implementation detail users can inspect under **Proof details**, not a separate task they must initiate.

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
SHA-256: <64 hexadecimal characters>

2. IMG_7124.jpg · 2.1 MB
SHA-256: <64 hexadecimal characters>

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

- One selected file can be checked against any fingerprint in the ProofStamp.
- Several selected files are checked as a multiset, so duplicate fingerprints cannot be reused more times than they appear in the ProofStamp.
- If the number of selected files equals the number of fingerprints and they all match, the selected files match the complete recorded collection.
- Legacy single-file ProofStamps remain valid and can still be verified.

A SHA-256 match shows that the compared byte sequences are identical with extremely high confidence.

It does not establish the original creation time, source, authorship, location, pre-ProofStamp editing history, or truth of the files' contents. Users should retain the exact original files and, when email timing matters, the full received email including headers.

## Deployment

The repository builds the static client to `dist/` with `npm run build`.

Cloudflare Pages can serve the static application. No API, database binding, or backend proof service is required. The remaining Pages middleware exists only to set `noindex, nofollow` on Cloudflare preview deployments.

A future service worker may cache the application shell for offline loading. It should cache application assets only, not user files, hashes, descriptions, recipient addresses, or generated ProofStamps.
