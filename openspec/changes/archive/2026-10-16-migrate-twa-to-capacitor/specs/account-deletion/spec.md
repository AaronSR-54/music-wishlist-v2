# Spec Delta

## MODIFIED Requirements

### Requirement: In-app account deletion
The app SHALL let a signed-in user delete their account from the Profile section, after an explicit confirmation step, and SHALL sign the user out and return them to the login screen once deletion succeeds. Before deleting, the app SHALL reauthenticate the user with the sign-in flow available on the current platform (native Google sign-in on the Android app, web popup in the browser).

#### Scenario: Confirmed deletion
- **WHEN** a signed-in user confirms the delete-account action
- **THEN** the app deletes the account and returns to the login screen signed out

#### Scenario: Cancelled deletion
- **WHEN** the user opens the delete-account confirmation and cancels it
- **THEN** the account and all its data remain unchanged and the user stays signed in

#### Scenario: Destructive action is guarded
- **WHEN** the user triggers delete-account
- **THEN** the app asks for an explicit confirmation before deleting anything

#### Scenario: Reauthentication on the native app
- **WHEN** a signed-in user confirms delete-account in the Android app
- **THEN** the app reauthenticates through the native sign-in flow before deleting the account

### Requirement: Deletion removes every user-owned data set
Deleting the account SHALL remove the user's wishlist entries, favorite artists, wishlist share records where the user is owner or recipient, wishlist invites they created, and their push notification registrations (web subscriptions and native device tokens).

#### Scenario: Wishlist and favorites are removed
- **WHEN** the account is deleted
- **THEN** the user's `wishlist` and `favorite-artists` documents no longer exist

#### Scenario: Sharing records are removed
- **WHEN** the account is deleted
- **THEN** the user's `wishlist-shares` (as owner and as recipient) and the `wishlist-invites` they created no longer exist

#### Scenario: Push subscription is removed
- **WHEN** the account is deleted
- **THEN** the user's server-side push registrations no longer exist and the local web subscription or native token is released
