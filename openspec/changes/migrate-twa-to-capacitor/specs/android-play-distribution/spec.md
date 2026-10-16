# Spec Delta

## REMOVED Requirements

### Requirement: Web content is served as a verified Trusted Web Activity
**Reason**: The Android app is replaced by a Capacitor application that bundles the web build locally and runs it in a WebView, so it never loads the remote origin through Custom Tabs and no Digital Asset Links verification is involved (see the `native-app-shell` capability).
**Migration**: Remove `public/.well-known/assetlinks.json`, the `/.well-known/assetlinks.json` header rule in `vercel.json` and all TWA/asset-links documentation. The signed AAB, version derivation and Play track publishing requirements remain in force.
