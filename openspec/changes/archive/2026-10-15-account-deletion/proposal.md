# Proposal

## Why

Google Play blocks publishing until the app's *Contenido de la app* section is complete, and two of its requirements are currently unmet: the app lets users create an account but offers no way to delete it (Play requires an in-app deletion path plus a public deletion URL), and reviewers cannot get past the Google Sign-In gate because the demo mode relies on a query param the TWA cannot receive. Closing these unblocks the store review.

## What Changes

- Add **in-app account deletion**: a destructive, confirmed action in Profile (Account section) that removes the signed-in user's Firestore data and then deletes the Firebase Auth account.
- Delete every user-owned collection: `wishlist`, `favorite-artists`, `wishlist-shares` (owner + recipient-side), `wishlist-invites` (as owner), and `push-subscriptions/{uid}` (server-side via `api/push.js`).
- Add a **public data-deletion page** (`/delete-account`) describing how to request deletion, used as the Data safety deletion URL.
- Extend the store prerequisites documentation to cover the remaining app-content items: reviewer **app access** (a Google test account with instructions), the **developer contact email**, and the **data deletion URL**.

## Capabilities

### New Capabilities
- `account-deletion`: In-app account and data deletion, plus the public deletion-request page required by Google Play.

### Modified Capabilities
- `android-play-distribution`: The documented store prerequisites now also cover app access (reviewer login instructions), developer contact details and the data deletion URL, not just Data safety, content rating, privacy policy and release notes.

## Impact

- `src/app/core/auth/auth.service.ts` (delete account orchestration), new `account-deletion` service or facade.
- Firestore services: `wishlist.service.ts`, `favorite-artists.service.ts`, `wishlist-share.service.ts`, `wishlist-invite.service.ts` (bulk deletes).
- `api/push.js` (reuse an action to delete the caller's push subscription) — no new endpoint (12/12 Vercel limit).
- `firestore.rules` (allow deleting shared/invite documents the user is party to, if not already permitted).
- Profile Account UI + i18n keys; new public page `public/delete-account.html`.
- Store docs (`store/app-content.md`, `store/README.md`); Play Console Data safety answers.
