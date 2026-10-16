# Spec Delta

## MODIFIED Requirements

### Requirement: Web content is served as a verified Trusted Web Activity
The Android app SHALL be a Trusted Web Activity that loads the production web app and SHALL be verified through Digital Asset Links so system chrome shows no URL bar. The served statement list MUST include the SHA-256 fingerprint of the certificate that signs the **installed** app, which for Play-distributed builds is the Play App Signing key and not the local upload key; the upload-key fingerprint MAY also be listed so locally signed builds verify.

#### Scenario: Asset links verified
- **WHEN** the Android app installed from Google Play launches on the production origin
- **THEN** the served Digital Asset Links file matches the Play App Signing key and no URL bar is displayed

#### Scenario: Locally signed build verified
- **WHEN** an AAB or APK signed with the local upload key is installed and launches on the production origin
- **THEN** the served Digital Asset Links file matches the upload key and no URL bar is displayed

#### Scenario: Asset links unavailable
- **WHEN** the Digital Asset Links file is missing or no listed fingerprint matches the installed signer
- **THEN** the app degrades to a Custom Tab that shows the URL bar, and this fallback is documented
