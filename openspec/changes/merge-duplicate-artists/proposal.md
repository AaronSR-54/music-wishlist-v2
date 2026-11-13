# Proposal

## Why

Deezer sometimes splits a single artist into two or more artist records. From the app the user sees
duplicate favorites, duplicated releases and two search entries for the same person, and there is
no way to tell the app they are the same artist.

## What Changes

- Add a **per-user artist merge**: the user opens an artist, uses "Unir artistas", searches the
  other profile or pastes its Deezer URL/id, and confirms. The viewed artist stays as the primary
  (canonical) one; the other becomes an alias.
- Store merges in a new `artist-merges` Firestore collection (`ownerUid`, `primaryArtistId`,
  `aliasArtistId`, names). Demo mode stores them in `artist-merges-demo-user`.
- The artist page loads the **union** of the group's top tracks and releases. Opening an alias
  route redirects to the primary.
- Favorites and search results dedupe by merge root, and the artist heart represents the whole
  group. Releases expands each favorite to all group ids.
- `api/check-releases.js` reads the user's merges and expands favorites with
  `expandFavoriteArtists()`, so daily push notifications include every profile of the artist.
- Firestore rules restrict the collection to its owner; account deletion removes the documents.

## Impact

- New `ArtistMergeService` and `ArtistMergePickerComponent`.
- Artist, search and releases components become merge-aware.
- No new API endpoints (still 12): the release cron reads the new collection with the same Firebase
  REST helpers it already uses.
