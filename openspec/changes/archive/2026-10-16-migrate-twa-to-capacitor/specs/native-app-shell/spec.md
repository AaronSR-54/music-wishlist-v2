# Spec Delta

## Purpose

Defines how the Android app is packaged with Capacitor so it runs the bundled Angular build
locally in a WebView as a standalone native app — no URL bar and no Digital Asset Links — and how
the native shell behaves (launch, back navigation, deep links and updates).

## ADDED Requirements

### Requirement: Bundled web build runs from the local origin
The Android app SHALL bundle the Angular production build inside the app and load it from the
app's local WebView origin, and MUST NOT depend on the remote origin or on Digital Asset Links to
render without browser chrome.

#### Scenario: Launches offline
- **WHEN** the app is cold-launched with no network connection
- **THEN** the bundled app shell renders instead of an error or a blank page

#### Scenario: No verification gates the launch
- **WHEN** the app launches
- **THEN** it shows the app without any browser URL bar and without performing asset-links verification

### Requirement: Standalone launch without browser chrome
The app SHALL launch in a standalone/fullscreen window with no browser UI.

#### Scenario: Normal launch
- **WHEN** the user opens the app from the launcher
- **THEN** the app fills the window with no address bar or browser chrome

#### Scenario: Splash matches the brand
- **WHEN** the app cold-launches
- **THEN** the splash/launch background uses the app background color with no white or off-brand flash

### Requirement: Native back button navigates within the app
The Android back button SHALL navigate through the app's own history and SHALL only close the app
at the root of the in-app navigation stack.

#### Scenario: Back from a detail page
- **WHEN** the user presses the system back button while on a pushed route such as an artist or album page
- **THEN** the app returns to the previous in-app route instead of closing

#### Scenario: Back at the root
- **WHEN** the user presses the system back button at the app's root view
- **THEN** the app closes

### Requirement: Deep links and notification taps open the matching route
The app SHALL route to the destination encoded in a notification payload or app link when opened
from it.

#### Scenario: Opened from a notification
- **WHEN** the app is opened by tapping a notification that targets an album or a wishlist tab
- **THEN** the app shows the corresponding route

### Requirement: Updates are delivered through Google Play
The native app SHALL update its bundled build only through Google Play releases; the browser
service-worker update flow does not apply to the native shell.

#### Scenario: New version available
- **WHEN** a newer app version is published on Google Play
- **THEN** the app is updated through the Play update flow rather than a web service worker
