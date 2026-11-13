# Tasks

## 1. Persistence
- [x] 1.1 Add `ArtistMergeService` with a `merges` signal, `resolveId`, `groupIds`, `groupMembers`, `nameOf`, `merge`, `unmerge` and `unmergeGroup`
- [x] 1.2 Persist merges in `artist-merges` (`ownerUid`, flat alias → primary) and in `artist-merges-demo-user` for demo mode
- [x] 1.3 Initialize the listener from `AuthService` (real and demo) and stop it on logout
- [x] 1.4 Add owner-only Firestore rules and delete `artist-merges` in account deletion

## 2. Merge UI
- [x] 2.1 Add "Unir artistas" to the artist page with a mobile-style sheet
- [x] 2.2 Search artists inside the sheet and accept a Deezer artist URL/id for records missing from the search index
- [x] 2.3 Show the merged aliases under the artist header with an "Deshacer unión" action
- [x] 2.4 Show the union of top tracks and releases, and redirect alias routes to the primary

## 3. Rest of the app
- [x] 3.1 Dedupe favorite artist cards and search artist rows by merge root
- [x] 3.2 Make the artist heart represent the whole group
- [x] 3.3 Expand favorites to the whole group before loading releases
- [x] 3.4 Expand favorites in `api/check-releases.js` with `expandFavoriteArtists()`

## 4. Verification
- [x] 4.1 Unit tests for merge, flattening, self-merge, unmerge and group ids
- [x] 4.2 Provider tests for `expandFavoriteArtists`
- [x] 4.3 Build, full Angular suite and API suite pass
- [x] 4.4 Verify in demo: merge by pasted Deezer URL, alias route redirect, releases query both ids, unmerge
