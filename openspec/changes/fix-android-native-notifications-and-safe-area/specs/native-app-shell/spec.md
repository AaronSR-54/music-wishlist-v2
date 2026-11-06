# Spec Delta

## ADDED Requirements

### Requirement: Routes outside the shell respect the system bar insets
The native app SHALL keep the chrome of full-screen routes that render outside the main shell
(such as Perfil) clear of the Android status bar and navigation/gesture bar, so no header text,
action or last content row is covered by the system bars.

#### Scenario: Perfil header below the status bar
- **WHEN** the user opens Perfil on a native device with edge-to-edge display enabled
- **THEN** the back action and the section title render fully below the status bar, not underneath
  its clock or icons

#### Scenario: Bottom content above the navigation bar
- **WHEN** the user scrolls Perfil to the end on a device with gesture navigation
- **THEN** the last content is reachable and not hidden behind the system navigation bar

#### Scenario: Web layout unchanged
- **WHEN** the user opens Perfil in a browser where the safe-area insets are zero
- **THEN** the screen keeps its existing spacing without extra blank bands
