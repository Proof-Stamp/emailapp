# MVP architecture

## Product flow

1. The user selects a file.
2. The browser calculates a SHA-256 fingerprint with Web Crypto.
3. The user adds a required description and primary email.
4. The user can add a recommended second mailbox for redundancy.
5. The app creates a text receipt and opens the user's default email client.
6. The user sends the receipt and preserves the original file.
7. The verification view hashes the preserved file and compares it with the stored fingerprint.

## Privacy boundary

The deployed app is a set of static files. There is no application server.

- Source files stay on the user's device.
- Email addresses stay in browser memory.
- Receipt generation uses a `mailto:` URL.
- No external processing is required.
- No account, cookies, telemetry, or database are required.

The external action begins only when the user opens their email client and sends the prepared message. At that point, the user's chosen email provider processes the receipt in the normal way.

## Receipt format

Downloaded receipts are plain-text `.txt` files. The email body, copied receipt, and downloaded receipt use the same readable format:

```text
PROOFSTAMP EMAIL RECEIPT

This receipt stores a unique fingerprint for the file described below.

Description: User-provided context
Filename: optional-name.jpg
File size: 12.1 KB (12345 bytes)
Media type: image/jpeg
File fingerprint (SHA-256): 64 hexadecimal characters
Receipt created on this device: 2026-08-17T18:00:00.000Z

Check this file later: https://email.proofstamp.org/verify

Keep the original file. If its fingerprint matches this receipt later, the file has not changed.

WHAT THIS RECEIPT DOES NOT PROVE
It does not prove when or where the file was originally created, who made it, whether it was edited before the receipt, or whether its contents are true. The email received time is a practical record of when the receipt reached your inbox.
```

The filename is optional. Delivery addresses are deliberately excluded from copied and downloaded receipts.

## Evidence model

A SHA-256 match shows that two sequences of bytes are identical with extremely high confidence. An email provider's received time can provide a practical third-party record that the receipt existed in that mailbox by that time.

It does not independently establish the original creation time, source, authorship, location, pre-receipt editing history, or truth of the file's contents. Users should retain the original file and the full email, including headers, when evidence quality matters.

## Initial deployment

The repository builds to `dist/` with `npm run build`. It can be hosted on Cloudflare Pages or any static host. The `_redirects` file sends `/verify` to the single-page app.

