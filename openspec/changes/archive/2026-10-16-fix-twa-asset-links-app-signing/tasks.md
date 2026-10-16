# Tasks

## 1. Capture the app signing fingerprint

- [ ] 1.1 From Play Console → *Release* → *Setup* → *App integrity* → *App signing key certificate*, copy the **SHA-256** of the Play App Signing key; if only the certificate is downloadable, recompute it with `keytool -printcert -file <cert>.der` or `openssl x509 -fingerprint -sha256 -noout -in <cert>.pem`. Verify the value is a colon-separated 32-byte hex string and that it differs from the upload-key fingerprint `8B:23:AF:5D:…`.

## 2. Update Digital Asset Links

- [ ] 2.1 Add the Play app signing SHA-256 to `sha256_cert_fingerprints` in `public/.well-known/assetlinks.json`, keeping the existing upload-key fingerprint. Verify the file still parses as JSON (`node -e "JSON.parse(require('fs').readFileSync('public/.well-known/assetlinks.json'))"`) and lists both fingerprints under `package_name` `com.musicwishlist.app`.
- [x] 2.2 Confirm `vercel.json` still forces `Content-Type: application/json` for `/.well-known/assetlinks.json` and add a regression note only if the header rule was altered. Verify the header rule is present in `vercel.json`.

## 3. Update the release documentation

- [x] 3.1 Rewrite section 3 of `store/README.md` so it states that the statement list MUST include the Play App Signing key SHA-256 (retrieved from *App integrity*), that the upload key is also listed for locally signed builds, and that Chrome may cache a previous failed verification (clear app data / reinstall before re-testing). Verify the documented retrieval path matches Play Console's current menu labels.
- [x] 3.2 Update the AGENTS.md line describing asset links so it no longer says "(upload-key SHA-256)" but references both the Play App Signing key and the upload key. Verify the text matches the actual file contents.

## 4. Version bump

- [x] 4.1 Bump `version` in `package.json` from `0.21.1` to `0.21.2` (micro: fix). Verify `npm run build` (or `node scripts/generate-version.js`) writes the new version into `src/version.json`.

## 5. Deploy and verify the TWA

- [ ] 5.1 Deploy to Vercel (automatic on push) and run `curl -sI https://music-wishlist-v2.vercel.app/.well-known/assetlinks.json`, verifying HTTP 200 and `content-type: application/json; charset=utf-8`; then `curl -s` the URL and verify the body contains the app signing fingerprint.
- [ ] 5.2 Query Google's statement-list API: `curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://music-wishlist-v2.vercel.app&relation=delegate_permission/common.handle_all_urls"` and verify the response includes the app signing fingerprint with no error.
- [ ] 5.3 On a physical device, reinstall the Play-delivered app (clear the app's data first), launch it, and verify it opens with no browser URL bar in standalone mode. Record the observed result as the acceptance check.

## Workflow follow-up

- Archive the change after verification on a real device confirms the TWA opens natively.
