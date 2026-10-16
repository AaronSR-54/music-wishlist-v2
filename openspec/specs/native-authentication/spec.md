# native-authentication Specification

## Purpose

Defines how users sign in with Google on the Android app through a native Capacitor plugin and how
that session integrates with the existing Firebase Auth data, including the reauthentication
required for sensitive actions.

## Requirements

### Requirement: Google Sign-In uses the native flow on Android
The Android app SHALL sign in with Google using a native Capacitor authentication plugin and MUST
NOT rely on an in-WebView OAuth popup.

#### Scenario: Successful native sign-in
- **WHEN** the user taps "Sign in with Google" in the app and completes the native account picker
- **THEN** the app establishes a signed-in session without opening a browser popup

#### Scenario: Sign-in cancelled
- **WHEN** the user dismisses the native account picker
- **THEN** the app stays on the login screen without an error state

### Requirement: Native sign-in integrates with Firebase Auth
The native sign-in SHALL produce a Firebase Auth session for the same account (same user id and
email) used by the web app, so the existing Firestore data and listeners apply unchanged.

#### Scenario: Same account data
- **WHEN** a user signs in on Android with the same Google account used on the web
- **THEN** the app loads that account's wishlist, favorites and shares

### Requirement: Reauthentication for sensitive actions is native
Sensitive actions that require a fresh login (account deletion) SHALL reauthenticate through the
native sign-in flow on the Android app.

#### Scenario: Reauthentication before deletion
- **WHEN** the user confirms account deletion in the Android app
- **THEN** the app completes a native reauthentication before deleting the account

### Requirement: Web sign-in is unchanged
The browser PWA SHALL keep its existing Google popup sign-in.

#### Scenario: Popup on the web
- **WHEN** the user signs in with Google in a browser
- **THEN** the app uses the web popup flow as before
