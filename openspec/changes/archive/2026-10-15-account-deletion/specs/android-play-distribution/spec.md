# Spec Delta

## MODIFIED Requirements

### Requirement: Store prerequisites are documented and provided
Because the Play API does not cover them, the store listing and app-content prerequisites — Data safety, content rating, privacy policy, localized release notes, reviewer app access, developer contact details and the data deletion URL — SHALL be documented and supplied as part of the release preparation.

#### Scenario: Preparing a first production release
- **WHEN** the operator prepares the first production release
- **THEN** the release notes are provided in Spanish and English and the manual Play Console steps (Data safety, content rating, privacy policy) are documented

#### Scenario: Documenting reviewer access
- **WHEN** the app-content access section is prepared
- **THEN** the instructions include a Google test account and the steps a Play reviewer must follow to reach the app's functionality

#### Scenario: Documenting contact details and deletion URL
- **WHEN** the store settings and Data safety sections are prepared
- **THEN** the developer contact details and a public data deletion URL are documented and set
