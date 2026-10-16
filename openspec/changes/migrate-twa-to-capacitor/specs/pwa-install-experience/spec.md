# Spec Delta

## MODIFIED Requirements

### Requirement: Launch colors avoid a mismatched splash
The installed PWA's launch background SHALL use the app background color so there is no flash of an unrelated color between launch and first paint.

#### Scenario: Cold launch in dark mode
- **WHEN** the installed app is cold-launched with the dark theme active
- **THEN** the launch background matches the dark app background and no white or off-brand flash is shown
