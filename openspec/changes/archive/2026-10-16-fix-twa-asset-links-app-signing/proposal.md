# Proposal

## Why

The version published on Google Play opens with the browser URL bar instead of running as a
native Trusted Web Activity: as soon as it launches it falls back to a Custom Tab that shows the
web page. The installed app is signed by Google's **Play App Signing** key, but
`public/.well-known/assetlinks.json` only lists the **upload key** fingerprint
(`8B:23:AF:5D:…` from `~/.config/music-wishlist/android.keystore`). Digital Asset Links
verification therefore fails and Chrome degrades the TWA to a Custom Tab.

## What Changes

- Add the **Play App Signing key** SHA-256 fingerprint (from Play Console → *App integrity* →
  *App signing key certificate*) to `public/.well-known/assetlinks.json`, keeping the upload-key
  fingerprint so locally signed builds still verify.
- Make the asset links requirement explicit: the served statement list MUST match the certificate
  that signs the installed app (the Play app signing key for Play-distributed builds), not only
  the local upload key.
- Repair the documented release flow so the app signing fingerprint is captured/updated as part of
  each release where it can change, and add a verification step to confirm the TWA launches without
  a URL bar before announcing a release.
- Fix the two stale docs that describe asset links as containing only the upload key
  (`store/README.md`, `AGENTS.md`).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `android-play-distribution`: The "Web content is served as a verified Trusted Web Activity"
  requirement is strengthened so the served Digital Asset Links file covers the certificate that
  actually signs the installed app (the Play app signing key), with an explicit verification step.

## Impact

- `public/.well-known/assetlinks.json` (new fingerprint entry).
- `store/README.md` and `AGENTS.md` (Digital Asset Links documentation).
- `vercel.json` (unchanged: already serves `application/json`).
- No new `api/*.js` endpoints; no client code, data model, or Firebase changes.
- Requires read access to Play Console *App integrity* (or the signing certificate) to obtain the
  app signing key SHA-256.
