# Spec Delta

## MODIFIED Requirements

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
