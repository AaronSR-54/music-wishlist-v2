# account-deletion Specification

## Purpose

Lets a signed-in user permanently delete their account and all data associated with it, and exposes the public deletion-request information Google Play requires for apps that allow account creation.

## Requirements

### Requirement: In-app account deletion
The app SHALL let a signed-in user delete their account from the Profile section, after an explicit confirmation step, and SHALL sign the user out and return them to the login screen once deletion succeeds.

#### Scenario: Confirmed deletion
- **WHEN** a signed-in user confirms the delete-account action
- **THEN** the app deletes the account and returns to the login screen signed out

#### Scenario: Cancelled deletion
- **WHEN** the user opens the delete-account confirmation and cancels it
- **THEN** the account and all its data remain unchanged and the user stays signed in

#### Scenario: Destructive action is guarded
- **WHEN** the user triggers delete-account
- **THEN** the app asks for an explicit confirmation before deleting anything

### Requirement: Deletion removes every user-owned data set
Deleting the account SHALL remove the user's wishlist entries, favorite artists, wishlist share records where the user is owner or recipient, wishlist invites they created, and their push notification subscription.

#### Scenario: Wishlist and favorites are removed
- **WHEN** the account is deleted
- **THEN** the user's `wishlist` and `favorite-artists` documents no longer exist

#### Scenario: Sharing records are removed
- **WHEN** the account is deleted
- **THEN** the user's `wishlist-shares` (as owner and as recipient) and the `wishlist-invites` they created no longer exist

#### Scenario: Push subscription is removed
- **WHEN** the account is deleted
- **THEN** the user's server-side push subscription no longer exists and the browser push subscription is released

### Requirement: Failed deletion is reported without raising a half-deleted account
If account deletion cannot be completed, the app SHALL show an error and keep the user signed in, and SHALL NOT delete the authentication account while leaving associated data behind.

#### Scenario: Deletion fails
- **WHEN** deleting the account fails partway through
- **THEN** the user stays signed in, sees an error, and the authentication account is not removed

### Requirement: Public data deletion page
The app SHALL expose a public page describing how to request deletion of an account and its data, reachable without signing in.

#### Scenario: Accessible without authentication
- **WHEN** the deletion page URL is opened by an anonymous visitor
- **THEN** the page renders its content without requiring sign-in

#### Scenario: Describes scope and contact
- **WHEN** the deletion page is read
- **THEN** it states what data is deleted and how to make the request
