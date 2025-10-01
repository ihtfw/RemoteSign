# Remote Sign Service

Simple Node.js service exposing POST /sign to code-sign a file using `osslsigncode` with PKCS#11.

## Endpoint

POST /sign
Header: Authorization: Bearer <AUTH_TOKEN>
Form-data: file (binary) uploaded as multipart/form-data

Returns: Signed binary stream with same filename.

### Concurrency / Queueing

Only one signing operation runs at a time. Additional requests are queued in-memory (FIFO) and each response is held open until its turn completes; no 423 is returned. A header `X-Queue-Position` is set when enqueued (0 for the active request). This queue is per-process; if you scale horizontally you need an external coordinator.

## Timestamp Servers Order

1. http://time.certum.pl
2. http://timestamp.digicert.com
3. http://timestamp.comodoca.com

Tries sequentially until one succeeds.

## Environment Variables

- AUTH_TOKEN: Shared bearer token required.
- PKCS11_CERT: PKCS#11 certificate identifier.
- PKCS11_KEY: PKCS#11 private key identifier.
- SIGN_URL: Product / company URL.
- PORT: (optional) default 3000.
- DRY_RUN: If set, no real signing; file simply copied to simulate success.

## Local Dev (Dry Run)

```
npm install
DRY_RUN=1 AUTH_TOKEN=devtoken PKCS11_CERT=dummy PKCS11_KEY=dummy SIGN_URL=https://example.com npm run dev
```

## Production Run

Ensure `osslsigncode` and required PKCS#11 modules installed at:

- /usr/lib/x86_64-linux-gnu/ossl-modules/pkcs11.so
- /usr/lib/librtpkcs11ecp.so

Then:

```
AUTH_TOKEN=secret \
PKCS11_CERT="pkcs11:object=..." \
PKCS11_KEY="pkcs11:object=..." \
SIGN_URL="https://example.com" \
node src/server.js
```

## Test

```
npm test
```

## Notes

- Temporary uploads stored under .tmp (add to .gitignore).
- Errors return JSON { error, detail }.
- In-memory queue only; consider persistence or distributed lock for scaling.
