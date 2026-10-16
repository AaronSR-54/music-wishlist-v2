# Design

## Context

See proposal.md (Why). The app ships as a Bubblewrap TWA (`android/`, package
`com.musicwishlist.app`, host `music-wishlist-v2.vercel.app`) and is distributed through Google
Play. `public/.well-known/assetlinks.json` is served statically by Vercel with
`Content-Type: application/json`. It currently lists a single fingerprint, the **upload key**
(`8B:23:AF:5D:…`, matching `~/.config/music-wishlist/android.keystore`).

Play-distributed installs are re-signed by Google: modern Play apps use **Play App Signing**, so
the certificate on the device is the *app signing key*, which differs from the upload key.
Digital Asset Links verification compares the installed app's signing certificate against the
statement list; no match ⇒ Chrome ignores the TWA and opens a Custom Tab (`fallbackType:
"customtabs"`), which is the reported "redirects to the web".

## Goals / Non-Goals

**Goals:**
- The statement list at `/.well-known/assetlinks.json` verifies the certificate that actually
  signs Play-distributed installs, so the TWA opens with no URL bar.
- The release/documentation flow captures the app signing fingerprint and verifies the result, so
  this regression does not recur (e.g. after a signing-key rotation).

**Non-Goals:**
- Changing `fallbackType`, TWA theming, or the static status/navigation bar behavior.
- Building or re-uploading an AAB: the fix is server-side (asset links) and requires no new Play
  release.
- Automating the Play Console *App integrity* page. The Play Developer API (and the existing
  `play.mjs`) does not expose the app signing certificate, so retrieval stays a documented manual
  step.

## Decisions

**1. List both fingerprints instead of replacing the upload key.**
Keep the upload-key entry and ADD the Play app signing key. Alternative — replace with only the
app signing key — would work for Play installs but break locally signed APKs and internal app
sharing builds that are signed with the upload key. Listing both keeps every distribution channel
verifiable and is what Google's DAL documentation allows (multiple `sha256_cert_fingerprints`).

**2. Obtain the app signing SHA-256 from Play Console.**
Retrieve it at Play Console → *Release* → *Setup* → *App integrity* → *App signing key
certificate* (SHA-256). If a certificate is downloaded, recompute with
`keytool -printcert -file <cert>.der` / `openssl x509 -fingerprint -sha256`. Rationale: the
developer API surface here has no endpoint for it, so a manual, documented step is honest and
reproducible. Alternative — add a `play.mjs` action — was rejected because there is no API backing
it.

**3. Keep asset links as a static file + Vercel content-type header.**
Unchanged from the existing approach. Alternative — a dynamic `/api` endpoint — is rejected: it
would consume one of the 12 serverless-endpoint slots (an AGENTS.md hard constraint) for static
data and add latency to a verification that Chrome caches.

**4. Verify before announcing.**
After deploy, check that the JSON is served as `application/json`, validate with Google's
statement-list tool, and confirm on a device that the installed app launches without a URL bar.
Because Chrome caches DAL results, verification may require clearing the app's data / reinstalling.

## Risks / Trade-offs

- **Chrome caches the previous (failing) verification** → After fixing the file, clear the app's
  Chrome/custom-tab cache or reinstall the app before re-testing; document this so a cached failure
  is not mistaken for a still-broken fingerprint.
- **Play App Signing key rotation changes the fingerprint** → Treat the app signing fingerprint as
  release-varying; the documented flow re-checks it whenever Play reports a new signing key.
- **App not enrolled in Play App Signing (unexpected for this app)** → The visible symptom would
  instead be a genuinely wrong fingerprint; retrieval from *App integrity* and the on-device check
  disambiguate which certificate to list.
- **Multiple fingerprints with one mismatch** → Verification succeeds if *any* listed fingerprint
  matches the signer, so keeping both keys is not harmful.
