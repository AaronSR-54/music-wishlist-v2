# Tasks

## 1. Firestore rules

- [x] 1.1 Add a `delete` rule for `wishlist-invites` (owner `wishlistOwnerId` or `invitedEmail == request.auth.token.email`) in `firestore.rules`.
- [x] 1.2 Add a recipient-side `delete` rule for `wishlist-shares` (`recipientEmail == request.auth.token.email`) in `firestore.rules`.
- [x] 1.3 Deploy the rules and verify the new deletes are permitted for a test user.

## 2. Data deletion service

- [x] 2.1 Add chunked batch-delete helpers (<500 ops) for `wishlist` and `favorite-artists` filtered by `addedByUid == uid`.
- [x] 2.2 Add deletion for `wishlist-shares` (`ownerUid == uid` and `recipientEmail == email`) and `wishlist-invites` (`wishlistOwnerId == uid` and `invitedEmail == email`).
- [x] 2.3 Release the browser push subscription and call the existing `api/push.js` `unsubscribe` action (no new endpoint).

## 3. Auth orchestration

- [x] 3.1 Add `AuthService.reauthenticate()` (Google popup) and `AuthService.deleteAccount()` that runs the data deletion and then `deleteUser()`, aborting with no changes if re-auth is cancelled.
- [x] 3.2 On success sign out and navigate to `/login`; on failure keep the session and surface an error.

## 4. UI and i18n

- [x] 4.1 Add a destructive "delete account" action in `profile-account.component.ts` with a `ModalComponent` confirmation; hide it in demo mode and disable it while running.
- [x] 4.2 Add es/en translation keys (action, confirm title/body, confirm/cancel, success and error) and wire the toast.

## 5. Public deletion page

- [x] 5.1 Add `public/delete-account.html` (bilingual, JS-free) stating what data is deleted and how to make the request.
- [x] 5.2 Verify it is served as a static file (not SPA-rewritten) and link it from `public/privacy.html`.

## 6. Play prerequisites documentation

- [x] 6.1 Update `store/app-content.md` with the reviewer Google test-account instructions, the developer contact email requirement and the data deletion URL.
- [x] 6.2 Update `store/README.md` prerequisites with the deletion URL and the contact email.
- [x] 6.3 Update the Data safety answers now that in-app deletion exists (deletion URL + in-app deletion path).

## 7. Verification

- [x] 7.1 Verify the flow deletes every collection, releases the push subscription and signs the user out; check the cancel and failure paths.
- [x] 7.2 `npm run build` passes and `package.json` version is bumped.
