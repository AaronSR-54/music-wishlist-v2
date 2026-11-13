# Spec Delta

## Purpose

Lets a user replace the artist picture with their own photo and keeps the catalog picture as the
fallback.

## ADDED Requirements

### Requirement: Per-user artist photo
The system SHALL let a signed-in user replace an artist photo with one from their device or an image
URL, storing the choice per user.

#### Scenario: Uploading a photo
- **WHEN** the user opens the artist photo sheet and picks an image from the device
- **THEN** the app resizes it in the browser, shows a preview and saves it as the artist photo

#### Scenario: Pasting an image URL
- **WHEN** the user pastes an http(s) image URL and saves
- **THEN** the app stores that URL as the artist photo
- **AND** an invalid URL shows an inline error instead of saving

#### Scenario: Restoring the catalog photo
- **WHEN** the user chooses "Usar la foto de Deezer"
- **THEN** the override is deleted and the Deezer photo is shown again

### Requirement: The override applies everywhere
The artist photo override SHALL be used wherever the artist picture is rendered.

#### Scenario: Artist page, favorites and search
- **WHEN** an override exists for an artist
- **THEN** the artist page cover, the favorite artist card and the search artist row show the custom photo

#### Scenario: Privacy and cleanup
- **WHEN** another user requests the override documents, or the owner deletes the account
- **THEN** Firestore rules deny the read and account deletion removes every `artist-images` document

#### Scenario: Demo mode
- **WHEN** the app runs in demo mode
- **THEN** overrides are stored in `artist-images-demo-user` and never touch Firestore
