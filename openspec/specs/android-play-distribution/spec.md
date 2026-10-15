# android-play-distribution Specification

## Purpose

Packages the hosted web app as an Android App Bundle (Trusted Web Activity) and makes it inspectable and publishable to Google Play tracks, while keeping the plain PWA install path.

## Requirements

### Requirement: Web content is served as a verified Trusted Web Activity
The Android app SHALL be a Trusted Web Activity that loads the production web app and SHALL be verified through Digital Asset Links so system chrome shows no URL bar.

#### Scenario: Asset links verified
- **WHEN** the installed Android app launches on the production origin
- **THEN** the served Digital Asset Links file matches the app signing key and no URL bar is displayed

#### Scenario: Asset links unavailable
- **WHEN** the Digital Asset Links file is missing or the fingerprint does not match
- **THEN** the app degrades to a Custom Tab that shows the URL bar, and this fallback is documented

### Requirement: Release build produces a signed AAB with mapping
A single documented command SHALL produce a signed Android App Bundle and the R8 `mapping.txt` at known output paths.

#### Scenario: Building a release bundle
- **WHEN** the operator runs the android build command
- **THEN** a signed `.aab` and a `mapping.txt` are written to predictable locations

### Requirement: Android version derives from the app version
The Android `versionCode` and `versionName` SHALL be derived from the project version so every release is monotonic and the version is not duplicated across sources.

#### Scenario: Bumping the project version
- **WHEN** the project version is bumped before a release
- **THEN** the newly built AAB uses a higher versionCode and a matching versionName

#### Scenario: Reusing an existing versionCode
- **WHEN** an AAB whose versionCode already exists on Play is uploaded
- **THEN** the tooling surfaces Play's "version code already used" error and supports re-targeting an already-uploaded artifact by version-code

### Requirement: Operator can inspect and publish to Play tracks
The operator SHALL be able to list current releases per track and upload or re-target an AAB to a track (`internal`, `alpha`, `beta`, `production`) through the provided CLI, without adding new serverless endpoints.

#### Scenario: Inspect track status
- **WHEN** the operator runs the status command
- **THEN** the uploaded versionCodes per track are listed

#### Scenario: Dry-run before publishing
- **WHEN** the operator runs the upload command with the dry-run flag
- **THEN** the Play edit is mounted and discarded without committing a release

#### Scenario: Publish a release to a track
- **WHEN** the operator runs the upload command without the dry-run flag
- **THEN** the release is committed to the chosen track and becomes subject to Google review

### Requirement: Store prerequisites are documented and provided
Because the Play API does not cover them, the store listing prerequisites — Data safety, content rating, privacy policy and localized release notes — SHALL be documented and supplied as part of the release preparation.

#### Scenario: Preparing a first production release
- **WHEN** the operator prepares the first production release
- **THEN** the release notes are provided in Spanish and English and the manual Play Console steps (Data safety, content rating, privacy policy) are documented
