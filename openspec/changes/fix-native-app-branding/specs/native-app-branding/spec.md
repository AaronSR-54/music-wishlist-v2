# Spec Delta

## Purpose

Defines the native identity of the Android app: the launcher icon, the splash/launch screen and the
system bars, so the installed app presents the brand consistently with the PWA and the store listing
on every supported Android version.

## ADDED Requirements

### Requirement: Launcher icon reflects the app brand
The installed Android app SHALL show the app brand mark (list + music note) on the brand background
as its launcher icon, and MUST NOT use the framework's default icon template. The adaptive,
round and monochrome variants MUST render the same mark consistently.

#### Scenario: Icon on the launcher and app switcher
- **WHEN** the app is installed and viewed on the home screen or in the app switcher
- **THEN** the icon shows the brand mark on the brand background rather than a default template logo

#### Scenario: Adaptive icon composition
- **WHEN** the device renders the adaptive (masked) icon
- **THEN** the brand mark sits inside the adaptive safe zone over the brand background color

### Requirement: Splash screen shows the brand mark
The launch screen SHALL render the brand mark centered on the app background color for every
supported density and for both portrait and landscape orientations, without a white or off-brand
background and without the default template mark.

#### Scenario: Cold launch in portrait
- **WHEN** the app is cold-launched in portrait
- **THEN** the splash shows the brand mark centered on the app background and transitions to the app without a mismatched flash

#### Scenario: Cold launch in landscape
- **WHEN** the app is cold-launched in landscape
- **THEN** the splash shows the brand mark centered on the app background without stretching or cropping artifacts

### Requirement: System bars follow the active theme
The status bar SHALL reflect the effective theme so its background and icon contrast match the
navigation bar, and this MUST hold on Android 15+ where edge-to-edge is enforced and the legacy
status-bar background-color API has no effect.

#### Scenario: Dark theme active
- **WHEN** the effective theme is dark
- **THEN** the status bar area matches the dark app background with light icons

#### Scenario: Light theme active
- **WHEN** the effective theme is light
- **THEN** the status bar area matches the light app background with dark icons

#### Scenario: Theme changes while running
- **WHEN** the user switches theme or the system preference changes
- **THEN** the status bar background and icon appearance update to match without a restart

#### Scenario: Android 15+ edge-to-edge
- **WHEN** the app runs on a device where edge-to-edge is enforced
- **THEN** the status bar area still matches the app background and its icons stay legible over both themes

### Requirement: Native brand assets are reproducible
The native icon and splash assets SHALL be regenerable from a single source brand asset through a
documented command, so every density and variant stays consistent when the brand changes.

#### Scenario: Regenerating from the source mark
- **WHEN** the generator is run with the source brand asset
- **THEN** it regenerates the launcher and splash resources for all densities and orientations

#### Scenario: Changing the source mark
- **WHEN** the source brand asset is updated and the generator is re-run
- **THEN** the native icon and splash reflect the new mark without manual per-density edits
