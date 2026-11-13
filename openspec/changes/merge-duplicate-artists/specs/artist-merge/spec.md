# Spec Delta

## Purpose

Lets a user declare that two Deezer artist records are the same person, so the app treats them as
one artist in the artist page, favorites, search, releases and push notifications.

## ADDED Requirements

### Requirement: Per-user artist merge
The system SHALL let a signed-in user merge two artist profiles, storing the relation per user and
outside the shared catalog.

#### Scenario: Merging from an artist page
- **WHEN** the user opens an artist, chooses "Unir artistas", picks another artist and confirms
- **THEN** the alias is stored under the viewed artist as primary and the app treats both as one

#### Scenario: The duplicate is not in search
- **WHEN** the user pastes a Deezer artist URL or id in the merge sheet
- **THEN** the app resolves that profile directly and offers it as a merge candidate

#### Scenario: The user cannot merge an artist with itself
- **WHEN** both selected profiles already resolve to the same artist
- **THEN** the merge is rejected with a message and nothing is stored

#### Scenario: Groups stay flat
- **WHEN** the user merges an artist that already had aliases into another artist
- **THEN** all its aliases move under the new primary instead of creating a chain

### Requirement: Combined artist page
The artist page SHALL show the union of every profile in the group and SHALL open the primary for
alias routes.

#### Scenario: Tracks and releases are combined
- **WHEN** the group has two profiles
- **THEN** the page shows the deduplicated top tracks and releases of both, sorted by date

#### Scenario: Opening an alias route
- **WHEN** the user opens `/artist/<alias>`
- **THEN** the app redirects to the primary artist route and loads the combined page

#### Scenario: Undo a merge
- **WHEN** the user chooses "Deshacer unión"
- **THEN** the alias documents are deleted and both profiles appear separately again

### Requirement: Favorites, search and releases use the group
The app SHALL deduplicate and expand artists by merge root wherever favorites are shown or used.

#### Scenario: One favorite card per artist
- **WHEN** both profiles of a merged artist are favorited
- **THEN** the favorites row shows one card for the group

#### Scenario: One search row per artist
- **WHEN** a search returns two profiles of the same merged artist
- **THEN** only the first record of the group is rendered

#### Scenario: Releases include both profiles
- **WHEN** releases load for a favorite that belongs to a merge group
- **THEN** the app queries every profile in the group and dedupes the resulting releases

#### Scenario: Push notifications include both profiles
- **WHEN** the daily release check runs for a user with merges
- **THEN** favorites are expanded to their whole group before querying providers

### Requirement: Merge privacy and cleanup
Merges SHALL be private to their owner and removed with the account.

#### Scenario: Another user cannot read a merge
- **WHEN** a different authenticated user requests the merge documents
- **THEN** Firestore rules deny the read

#### Scenario: Account deletion
- **WHEN** the user deletes their account
- **THEN** every `artist-merges` document owned by them is deleted

#### Scenario: Demo mode
- **WHEN** the app runs in demo mode
- **THEN** merges are stored in `artist-merges-demo-user` and never touch Firestore
