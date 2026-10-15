# play-store-listing Specification

## Purpose

Defines the content and assets of the app's Google Play store listing — localized text plus icon, feature graphic and phone screenshots — and the guarantees for keeping them in sync with the published store page.

## Requirements

### Requirement: Localized listing text
The listing SHALL provide a title, a short description and a full description for English (the default listing language) and Spanish, sourced from versioned repository files and within Play's length limits (title ≤ 30, short description ≤ 80, full description ≤ 4000 characters).

#### Scenario: English default listing
- **WHEN** the listing is applied
- **THEN** an `en-US` listing carries the English title, short description and full description

#### Scenario: Spanish listing
- **WHEN** the listing is applied
- **THEN** an `es-ES` listing carries the Spanish title, short description and full description

#### Scenario: Over-length copy is rejected before upload
- **WHEN** a copy file exceeds Play's character limit for its field
- **THEN** the tooling fails before committing the edit and names the offending field

### Requirement: Complete, Play-compliant graphics
The listing SHALL include a 512×512 app icon, a 1024×500 feature graphic, and between 2 and 8 phone screenshots formatted as JPEG or 24-bit PNG without alpha, within Play's dimension and aspect-ratio limits.

#### Scenario: Required images are present
- **WHEN** the listing is applied
- **THEN** an icon, a feature graphic and at least two phone screenshots are uploaded for the listing

#### Scenario: Invalid screenshot is rejected
- **WHEN** a candidate screenshot has alpha, an unsupported format, or a dimension outside Play's limits
- **THEN** the tooling fails before committing the edit and names the offending file

### Requirement: Screenshots cover every app section
Phone screenshots SHALL be raw captures of the running app with no device frames or overlaid captions, and MUST collectively show every user-facing section: releases, search, wishlist, artist, album and profile/login.

#### Scenario: Section coverage
- **WHEN** the set of phone screenshots is reviewed
- **THEN** each of releases, search, wishlist, artist, album and profile/login is visible in at least one screenshot

#### Scenario: Raw captures only
- **WHEN** a phone screenshot is inspected
- **THEN** it shows the unmodified app UI without a device frame or added text overlay

### Requirement: Listing is applied through the Play API
The tooling SHALL upsert the localized listing text and upload the graphics within a single Play edit and commit that edit once; re-running the command against unchanged sources SHALL NOT create duplicate listings or images.

#### Scenario: Dry-run applies nothing
- **WHEN** the listing command runs with the dry-run flag
- **THEN** the edit is mounted and discarded and the live store page is unchanged

#### Scenario: Commit applies the listing
- **WHEN** the listing command runs without the dry-run flag
- **THEN** the edit is committed and the store page reflects the new text and images

#### Scenario: Re-running is idempotent
- **WHEN** the listing command runs twice with the same sources
- **THEN** the second run leaves the same single set of listing fields and images per language

### Requirement: Listing sources are version-controlled
The listing copy and images SHALL live in the repository so the store page can be reproduced or updated from a clean checkout.

#### Scenario: Reproduce from a clean checkout
- **WHEN** an operator checks out the repository and runs the documented listing command
- **THEN** the listing can be rebuilt from the committed copy and images without manual re-authoring
