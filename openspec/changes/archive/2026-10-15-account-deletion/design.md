# Design

## Context

See `proposal.md` — Why. Relevant current state:

- Auth is Firebase Google Sign-In (`AuthService`), with Firestore data in `wishlist`, `favorite-artists`, `wishlist-shares`, `wishlist-invites` and `push-subscriptions/{uid}`.
- `firestore.rules` allow a user to delete their own `wishlist` (owner) and `favorite-artists`, but **not** `wishlist-invites` (no `delete` rule) nor recipient-side `wishlist-shares`.
- Push subscriptions are managed server-side by `api/push.js`; its `unsubscribe` action removes the caller's `clientId` and deletes the document when no clients remain.
- Vercel is at the 12/12 serverless-endpoint limit, so no new `api/*.js` file can be added.
- `vercel.json` already excludes `.html` from the SPA rewrite and the custom service worker serves non-shell documents from the network, so a static public page works (pattern established by `public/privacy.html`).
- Demo mode (`?demo`) uses a synthetic `demo-user` with no real Firebase account.

## Goals / Non-Goals

**Goals:**

- A safe, confirmed, in-app delete-account flow covering all user-owned data.
- Satisfy Play's app-access, contact and data-deletion prerequisites.
- No new serverless endpoint.

**Non-Goals:**

- Admin/back-office deletion, soft delete or undo, data export, or deleting documents the user is not a party to.
- Deleting shared data owned by other users (only the leaving user's own records and the shares/invites they are party to).
- Programmatic Play Console declarations (Data safety, content rating, category) — those stay manual.

## Decisions

### 1. Orchestrate deletion on the client, reuse `api/push.js`
A new client service drives the whole deletion; the push subscription is released by the browser and removed server-side via the existing `unsubscribe` action.
- **Why**: keeps within the 12/12 endpoint budget and reuses proven code.
- **Alternatives considered**: a dedicated `api/delete-account` endpoint (rejected: endpoint limit, `firebase-admin` issues on Vercel).

### 2. Re-authenticate with Google before deleting anything
Before any deletion, re-run the Google sign-in popup to obtain a fresh credential.
- **Why**: Firebase `deleteUser()` fails with `auth/requires-recent-login` for stale sessions; re-authenticating up front avoids a half-run and doubles as an identity check. If the user cancels the popup, abort with no changes.
- **Alternatives considered**: attempt delete and re-auth only on failure (rejected: can fail after data removal).

### 3. Delete data first, then the Auth account
Order: (a) browser push unsubscribe + `api/push.js` unsubscribe, (b) Firestore bulk deletes, (c) `deleteUser()`.
- **Why**: the spec forbids deleting the Auth account while associated data remains; this order never orphans data. If (c) fails after (a)+(b), the user is still signed in with empty data and sees an error they can retry.
- **Alternatives considered**: delete Auth first (rejected: orphans data on partial failure).

### 4. Delete by queried ownership, chunked into batches
Remove `wishlist` and `favorite-artists` where `addedByUid == uid`; `wishlist-shares` where `ownerUid == uid` **or** `recipientEmail == email`; `wishlist-invites` where `wishlistOwnerId == uid` **or** `invitedEmail == email`. Use batched deletes chunked below Firestore's 500-op limit.
- **Why**: covers both sides of sharing so no dangling share/invite references the deleted user.

### 5. Extend `firestore.rules` for the new deletions
Add `delete` for `wishlist-invites` (owner or invited email) and for `wishlist-shares` on the recipient side (owner side already deletable).
- **Why**: otherwise the client deletes are rejected. Rules must be redeployed with the app.

### 6. Static, JS-free public deletion page
Add `public/delete-account.html`, bilingual like `privacy.html`, reachable anonymously and used as the Data safety deletion URL.
- **Why**: Play's checker reads raw HTML; a static page needs no auth and no JS. The `.html` SPA-rewrite exclusion already handles routing.

### 7. Destructive UI in Profile → Account, hidden in demo
Add a destructive "delete account" action with a `ModalComponent` confirmation, disabled while running, and hidden in demo mode.
- **Why**: matches the existing confirmation/modal pattern and avoids a fake account deletion in demo.

## Risks / Trade-offs

- **Re-auth popup blocked** → the flow aborts before deleting anything and shows an error; no data is lost.
- **Partial failure after data removal** → account remains with empty data; user can retry. Accepted and documented.
- **Rules not deployed** → deletes fail with permission errors; the flow reports an error and stops. Deploying `firestore.rules` is a release step.
- **Deleting an owner removes shared entries for recipients** → expected: the data belongs to the owner.
- **Large collections** → chunked batches; acceptable without server-side pagination.
