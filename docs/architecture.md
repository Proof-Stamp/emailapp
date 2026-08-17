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
- No blockchain transaction is created.
- No account, cookies, telemetry, or database are required.

The external action begins only when the user opens their email client and sends the prepared message. At that point, the user's chosen email provider processes the receipt in the normal way.

## Receipt schema

JSON receipts use the following shape:

```json
{
  "schema": "org.proofstamp.email-receipt",
  "version": "1.0",
  "hash_algorithm": "SHA-256",
  "hash": "64 hexadecimal characters",
  "description": "User-provided context",
  "file_name": "optional-name.jpg",
  "file_size_bytes": 12345,
  "media_type": "image/jpeg",
  "created_at_device": "ISO 8601 informational device time",
  "verification_url": "https://email.proofstamp.org/verify",
  "app_version": "0.1.0"
}
```

Delivery addresses are deliberately excluded from exported receipts.

## Evidence model

A SHA-256 match shows that two sequences of bytes are identical with extremely high confidence. An email provider's received time can provide a practical third-party record that the receipt existed in that mailbox by that time.

It does not independently establish the original creation time, source, authorship, location, pre-receipt editing history, or truth of the file's contents. Users should retain the original file and the full email, including headers, when evidence quality matters.

## Initial deployment

The repository builds to `dist/` with `npm run build`. It can be hosted on Cloudflare Pages or any static host. The `_redirects` file sends `/verify` to the single-page app.

