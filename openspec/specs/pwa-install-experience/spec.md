# pwa-install-experience Specification

## Purpose

Defines how the app presents itself once installed (PWA or TWA), guaranteeing that its system chrome and launch colors follow the active theme and that install metadata stays consistent.

## Requirements

### Requirement: Installed theme-color follows the active theme
The installed app's system chrome color SHALL reflect the effective theme (light, dark, or system) instead of a fixed value. It MUST update when the user changes the theme or when the OS preference changes.

#### Scenario: User selects dark theme
- **WHEN** the user selects the dark theme while the app is installed
- **THEN** the reported theme-color resolves to the dark app background and the status bar matches it

#### Scenario: User selects light theme
- **WHEN** the user selects the light theme while the app is installed
- **THEN** the reported theme-color resolves to the light app background and the status bar matches it

#### Scenario: System theme changes while installed
- **WHEN** the theme is set to "system" and the OS switches between light and dark
- **THEN** the reported theme-color updates to the matching app background without a full reload

### Requirement: Manifest install metadata is consistent
The web app manifest SHALL be the single source of truth for `theme_color` and `background_color`, consistent with the app's default theme, and SHALL define install identity fields including `id`, `scope`, `start_url`, `lang`, `dir`, `display_override`, `orientation` and `categories`.

#### Scenario: Manifest and meta tags agree
- **WHEN** the page loads
- **THEN** the manifest theme_color and the default page meta theme-color refer to the same color and no contradictory duplicated color remains

#### Scenario: Install identity present
- **WHEN** a browser or TWA tooling reads the manifest
- **THEN** `id`, `scope` and `start_url` are present and mutually consistent

### Requirement: Launch colors avoid a mismatched splash
The installed PWA's launch background SHALL use the app background color so there is no flash of an unrelated color between launch and first paint.

#### Scenario: Cold launch in dark mode
- **WHEN** the installed app is cold-launched with the dark theme active
- **THEN** the launch background matches the dark app background and no white or off-brand flash is shown

### Requirement: PWA install remains available
The app SHALL remain installable as a standard PWA so users can still add it to their home screen from a supported browser without going through Google Play.

#### Scenario: Browser offers standalone install
- **WHEN** the app is served over HTTPS with a valid manifest and an active service worker
- **THEN** the supported browser offers to install the app and the installed PWA launches in standalone display mode
