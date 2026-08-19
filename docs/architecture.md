# MVP architecture

## Product flow

1. The user selects 1–5 files.
2. The browser calculates a SHA-256 fingerprint for each file with Web Crypto.
3. The user adds one required description and a destination email.
4. The user can add an optional CC address.
5. The app creates one ProofStamp and opens the user's default email client.
6. The user sends the ProofStamp email and preserves the original files.
7. The verification view can check one file, several files, or all files against the fingerprints stored in the ProofStamp.

## Privacy boundary

File processing remains local to the browser.

- Source files stay on the user's device.
- Files are read only inside the browser for hashing.
- Email addresses stay in browser memory and are used only to construct the local `mailto:` URL.
- No file contents, fingerprints, filenames, descriptions, email addresses, or file metadata are sent to ProofStamp.
- No registration, cookies, user account, or identity tracking is required.

The app sends two optional aggregate usage events to the same-origin `/api/metrics` Pages Function:

- `{ "event": "proof_created", "fileCount": 1..5 }`
- `{ "event": "email_opened" }`

These events update a single aggregate row in Cloudflare D1. There is no per-user or per-ProofStamp event table. The counters are used to calculate total ProofStamps created, the share that opened the email app, and average files per ProofStamp.

The `email_opened` event records a click on the button that hands the prepared `mailto:` URL to the user's device. It cannot confirm that the email was actually sent.

## File fingerprints

Every selected file gets its own SHA-256 fingerprint. This lets a recipient verify any individual file later and keeps the format simple: a multi-file ProofStamp is just one description plus a list of file fingerprints.

## ProofStamp format

The email body, copied ProofStamp, and downloaded ProofStamp use the same readable plain-text format. A multi-file example looks like this:

```text
PROOFSTAMP

I sent you a ProofStamp for Apartment condition before moving out.

3 files were fingerprinted. Use this to check whether they match later.

VERIFY THE FILES
https://email.proofstamp.org/verify

DETAILS
1. front.jpg · 1.0 MB
SHA-256: <64 hexadecimal characters>

2. kitchen.jpg · 2.0 MB
SHA-256: <64 hexadecimal characters>

3. bedroom.jpg · 1.5 MB
SHA-256: <64 hexadecimal characters>

Created at: August 19, 2026 at 4:24 PM UTC

Keep the original files. Matching fingerprints later mean the files have not changed.

ABOUT THIS PROOFSTAMP
Matching fingerprints confirm the files are unchanged. The email received time shows when this ProofStamp reached the inbox.

Free. Private. No registration. Your files stay on your device.

ProofStamp your own files →
https://email.proofstamp.org/
```

Filenames are optional. Delivery addresses are deliberately excluded from copied and downloaded ProofStamps.

## Verification model

When a user pastes a ProofStamp email, the verifier extracts the individual file fingerprints.

- One selected file can be checked against any file fingerprint in the ProofStamp.
- Several selected files are checked as a multiset, so duplicate fingerprints cannot be reused more times than they appear in the ProofStamp.
- If the number of selected files equals the number of fingerprints in the ProofStamp and they all match, the selected files match the complete recorded collection.
- Legacy single-file ProofStamps remain valid and can still be verified.

A SHA-256 match shows that two sequences of bytes are identical with extremely high confidence. An email provider's received time can provide a practical third-party record that the ProofStamp existed in that mailbox by that time.

It does not independently establish the original creation time, source, authorship, location, pre-ProofStamp editing history, or truth of the files' contents. Users should retain the original files and the full email, including headers, when evidence quality matters.

## Aggregate metrics

`functions/api/metrics.js` uses a D1 binding named `METRICS_DB` and maintains one row with:

- `proofstamps_created`
- `email_app_opened`
- `total_files`
- `updated_at`

`GET /api/metrics` derives:

- total ProofStamps created
- email-app open rate
- average files per ProofStamp

The database starts at zero when first configured. Historical ProofStamps created before this counter existed cannot be reconstructed from these metrics.

## Deployment

The repository builds the static client to `dist/` with `npm run build`. Cloudflare Pages serves the static files and the `/functions` directory provides the metrics endpoint. The `_redirects` file sends `/verify` to the single-page app.
