# native-app-branding Specification

## Purpose

Defines the native identity of the Android app: the launcher icon, the splash/launch screen and the
system bars, so the installed app presents the brand consistently with the PWA and the store listing
on every supported Android version.

## Requirements

### Requirement: Launcher icon reflects the app brand
The installed Android app SHALL show the app brand mark (list + music note) on the brand background
as its launcher icon, and MUST NOT use the framework's default icon template. The adaptive, round
and monochrome variants MUST render the same mark consistently, centered and at the same apparent
scale, with the mark fully inside the adaptive-icon safe zone and a deliberate margin on every side
so no launcher mask (circle, squircle, rounded square) crops or crowds it.

#### Scenario: Icon on the launcher and app switcher
- **WHEN** the app is installed and viewed on the home screen or in the app switcher
- **THEN** the icon shows the brand mark on the brand background rather than a default template logo

#### Scenario: Adaptive icon composition
- **WHEN** the device renders the adaptive (masked) icon
- **THEN** the brand mark sits inside the adaptive safe zone over the brand background with visible
  margin around it, not touching any edge of the mask

#### Scenario: Mask shapes
- **WHEN** the launcher applies a circle, squircle or rounded-square mask to the adaptive icon
- **THEN** the whole mark stays visible with the same margin and is never clipped or crowded

#### Scenario: Variant consistency
- **WHEN** the adaptive icon, the round icon and the legacy square icon are compared side by side
- **THEN** the mark appears at the same apparent scale in all of them, with the legacy square icon on
  the brand background

#### Scenario: Every density
- **WHEN** the icon is rendered at mdpi, hdpi, xhdpi, xxhdpi or xxxhdpi
- **THEN** the mark keeps the same proportion and margin at that density

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
Each system bar area SHALL render the same background as the app chrome adjacent to it, keeping the
app continuous edge to edge: the status-bar area matches the top background and the navigation-bar
area matches the footer/tab bar. Icon and gesture-handle contrast MUST stay legible in both themes,
including on Android 15+ where edge-to-edge is enforced and the legacy bar background-color APIs have
no effect.

#### Scenario: Dark theme active
- **WHEN** the effective theme is dark
- **THEN** the status-bar area matches the dark top background and the navigation-bar area matches the dark footer, both with light icons

#### Scenario: Light theme active
- **WHEN** the effective theme is light
- **THEN** the status-bar area matches the light top background and the navigation-bar area matches the light footer, both with dark icons

#### Scenario: Navigation bar matches the footer
- **WHEN** the app shows its mobile layout with the footer/tab bar
- **THEN** the gesture navigation-bar area renders the footer background color rather than the page background

#### Scenario: Theme changes while running
- **WHEN** the user switches theme or the system preference changes
- **THEN** both bar areas and their icon appearance update to match without a restart

#### Scenario: Android 15+ edge-to-edge
- **WHEN** the app runs on a device where edge-to-edge is enforced
- **THEN** both bar areas still match their adjacent chrome and their icons stay legible over both themes

### Requirement: Native brand assets are reproducible
The native icon and splash assets SHALL be regenerable from a single source brand asset through a
documented command, so every density and variant stays consistent when the brand changes.

#### Scenario: Regenerating from the source mark
- **WHEN** the generator is run with the source brand asset
- **THEN** it regenerates the launcher and splash resources for all densities and orientations

#### Scenario: Changing the source mark
- **WHEN** the source brand asset is updated and the generator is re-run
- **THEN** the native icon and splash reflect the new mark without manual per-density edits
