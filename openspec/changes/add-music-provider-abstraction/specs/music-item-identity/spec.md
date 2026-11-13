# Spec Delta

## Purpose

Defines how catalog items are identified across providers so tracks, albums and artists from
Deezer and YouTube can coexist in routes, the wishlist, favorites and local state without id
collisions, while legacy Deezer ids keep working.

## ADDED Requirements

### Requirement: Provider-scoped identifier format
The system SHALL represent every catalog item identity as `<provider>:<externalId>`, and SHALL
resolve a bare identifier with no provider prefix as a Deezer item.

#### Scenario: Provider-scoped id
- **WHEN** an item arrives from YouTube with external id `vid123`
- **THEN** its identity is `youtube:vid123` everywhere it is stored, routed or compared

#### Scenario: Legacy Deezer id
- **WHEN** the system reads a bare numeric id such as `6516139` from a route, a wishlist entry or a
  favorite artist
- **THEN** it resolves the item as `deezer:6516139`

#### Scenario: Same external id from two providers
- **WHEN** two providers return an item with the same external id text
- **THEN** the two items are treated as different items and both remain in the wishlist

### Requirement: Detail routes resolve by provider-scoped id
The album and artist routes SHALL accept provider-scoped identifiers and SHALL load the detail
from the identified provider.

#### Scenario: Opening a YouTube album route
- **WHEN** the user opens `/album/youtube:PL123`
- **THEN** the album detail loads from YouTube

#### Scenario: Opening a legacy album route
- **WHEN** the user opens `/album/6516139`
- **THEN** the album detail loads from Deezer

#### Scenario: Unknown or malformed provider
- **WHEN** the route contains a provider that is not registered
- **THEN** the page shows a not-found state and does not fetch Deezer data under that provider

### Requirement: Persisted items retain their provider
Wishlist entries and favorite artists SHALL persist the item's provider, and SHALL read documents
without a provider field as Deezer.

#### Scenario: Saving a YouTube item
- **WHEN** the user adds a YouTube video
- **THEN** the stored document includes the provider and the provider-scoped id

#### Scenario: Reading legacy wishlist documents
- **WHEN** the wishlist loads entries created before this change
- **THEN** those entries display and resolve as Deezer items without a migration

#### Scenario: Shared wishlists keep provider identity
- **WHEN** a shared wishlist displays entries owned by another user
- **THEN** each entry keeps its provider and opens the correct detail page

### Requirement: External links follow the item's provider
The system SHALL build "open externally" links and share text from the item's provider, not from
a hard-coded Deezer URL.

#### Scenario: Opening a YouTube item externally
- **WHEN** the user opens a YouTube video externally
- **THEN** the link targets YouTube with that item's external id

#### Scenario: Deezer item link unchanged
- **WHEN** the user opens a Deezer track or album externally
- **THEN** the link keeps the existing Deezer target

### Requirement: Navigation keeps the provider
The system SHALL keep the current provider when navigating from a search result or a detail page
to a related album or artist.

#### Scenario: From album to its artist
- **WHEN** the user opens the artist from a YouTube album page
- **THEN** the artist route uses the YouTube provider-scoped id

#### Scenario: From search result to album
- **WHEN** the user opens an album from a YouTube search result
- **THEN** the album route uses the YouTube provider-scoped id

### Requirement: Local search state preserves the provider
The system SHALL persist the active provider with saved search state so a restored search query
returns results from the same provider.

#### Scenario: Restoring a saved search
- **WHEN** the user returns to the search tab in the same session after searching videos
- **THEN** the saved query, filters and video results are restored together

#### Scenario: Cached results do not collide
- **WHEN** albums from two providers share the same external id text
- **THEN** each cached album and track list is stored under its provider-scoped id
