# MVP architecture

## Product flow

1. The user selects 1–10 files.
2. The browser calculates a SHA-256 fingerprint for each file with Web Crypto.
3. If several files are selected, the browser also creates one set fingerprint from the individual fingerprints.
4. The user adds one required description and a destination email.
5. The user can add an optional CC address.
6. The app creates one ProofStamp and opens the user's default email client.
7. The user sends the ProofStamp email and preserves the original files.
8. The verification view can check one file, several files, or the complete set against the fingerprints stored in the ProofStamp.

## Privacy boundary

The deployed app is a set of static files. There is no application server.

- Source files stay on the user's device.
- Files are read only inside the browser for hashing.
- Email addresses stay in browser memory.
- ProofStamp email generation uses a `mailto:` URL.
- No external processing is required.
- No registration, cookies, telemetry, or database are required.

The external action begins only when the user opens their email client and sends the prepared message. At that point, the user's chosen email provider processes the ProofStamp email in the normal way.

## File fingerprints

Every selected file gets its own SHA-256 fingerprint. This is the primary verification primitive because it lets a recipient check any individual file later.

For a multi-file ProofStamp, the app also creates a set fingerprint:

1. Normalize every individual SHA-256 fingerprint to lowercase.
2. Sort the fingerprints lexicographically.
3. Join them with newline characters.
4. SHA-256 hash that canonical string.

Sorting makes the set fingerprint independent of the order in which the files were selected. Duplicate file fingerprints remain duplicated, so the set fingerprint also commits to their count.

The set fingerprint does not replace the individual file fingerprints. It provides an additional way to check that the complete collection is the same collection recorded in the ProofStamp.

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

Set fingerprint (SHA-256):
<64 hexadecimal characters>
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

When a user pastes a ProofStamp email, the verifier extracts the individual file fingerprints separately from the optional set fingerprint.

- One selected file can be checked against any file fingerprint in the ProofStamp.
- Several selected files are checked as a multiset, so duplicate fingerprints cannot be reused more times than they appear in the ProofStamp.
- When the number of selected files equals the number recorded in the ProofStamp, the app also checks the set fingerprint when one is present.
- Legacy single-file ProofStamps remain valid and can still be verified.

A SHA-256 match shows that two sequences of bytes are identical with extremely high confidence. An email provider's received time can provide a practical third-party record that the ProofStamp existed in that mailbox by that time.

It does not independently establish the original creation time, source, authorship, location, pre-ProofStamp editing history, or truth of the files' contents. Users should retain the original files and the full email, including headers, when evidence quality matters.

## Initial deployment

The repository builds to `dist/` with `npm run build`. It can be hosted on Cloudflare Pages or any static host. The `_redirects` file sends `/verify` to the single-page app.
