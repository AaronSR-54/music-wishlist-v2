# Spec Delta

## Purpose

Defines how a video result plays inside the app after the user opens it.

## ADDED Requirements

### Requirement: Video playback starts immediately
Opening a video in the preview sheet SHALL start playback without an extra tap.

#### Scenario: Autoplay with sound
- **WHEN** the user opens a video and the browser allows audible autoplay
- **THEN** the video starts playing with sound

#### Scenario: Autoplay blocked
- **WHEN** the browser blocks audible autoplay
- **THEN** the video starts playing muted
- **AND** the sheet shows an "Activar sonido" button that unmutes it

#### Scenario: Player API unavailable
- **WHEN** the YouTube IFrame API cannot be loaded
- **THEN** the sheet falls back to a plain embedded player with `autoplay=1`

### Requirement: Player lifecycle
The sheet SHALL release the player when it closes.

#### Scenario: Closing the sheet
- **WHEN** the user closes the sheet or presses Escape
- **THEN** playback stops and the player is destroyed

#### Scenario: No video id
- **WHEN** the result has no resolvable YouTube id
- **THEN** the sheet shows the "Vídeo no disponible" state instead of a player
