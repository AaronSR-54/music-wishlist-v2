# Tasks

> **Decision update (2026-11-13):** the abstraction ships with exactly two providers.
> Deezer is the whole searchable catalog (artists, tracks, albums, EPs) and YouTube only powers
> the `Vídeos` filter; videos open in an in-app preview modal. Spotify and iTunes were removed
> (adapters, availability, env vars and tests) before release, so the Spotify/iTunes material
> below is historical rationale, not the shipped behavior. Ranking (`catalog-rank.ts`) and
> saved-artist injection were added on top of the single Deezer catalog.

## 1. Server provider foundation

- [x] 1.1 Create `lib/providers/contract.js` with the adapter method contract, provider-neutral DTO builders, catalog-id helpers (`parseCatalogId`/`toCatalogId`) and typed provider errors (unknown, unavailable, upstream); verify with `node --check lib/providers/contract.js`
- [x] 1.2 Create `lib/providers/index.js` as the registry (`getProvider`, `listProviders`, `isAvailable`) and add `tests/providers/registry.test.mjs`; add a `test:api` script using `node --test tests/**/*.test.mjs`; verify `npm run test:api` passes
- [x] 1.3 Extract the Deezer URL building and response normalization from the current endpoints into `lib/providers/deezer.js` (search tracks/albums/artists, album, album tracks, artist, artist top tracks, artist albums, track); add `tests/providers/deezer.test.mjs` covering record-type mapping, cover fallback, release-date padding and missing preview; verify `npm run test:api` passes
- [x] 1.4 Document the provider module, the `provider` and `format=neutral` parameters, and the 12-endpoint constraint in `AGENTS.md`; verify the documented paths and parameter names match the code

## 2. Wire the existing endpoints

- [x] 2.1 Update `api/search.js` to accept `provider`, return the legacy Deezer payload when `format` is absent, return neutral results for `format=neutral`, and serve `?providers=1` metadata; verify with `curl` that Deezer legacy, Deezer neutral, unknown provider (400) and unconfigured provider (503) behave as specified
- [x] 2.2 Update `api/search/album.js` and `api/search/artist.js` with the same provider/format handling; verify each with a Deezer neutral request and an unknown-provider request
- [x] 2.3 Update `api/album.js`, `api/album-tracks.js` and `api/track.js` to delegate to the registry; verify legacy and neutral responses for a known Deezer album/track
- [x] 2.4 Update `api/artist.js`, `api/artist-info.js` and `api/artist-albums.js` to delegate to the registry, preserving the `limit` clamp in artist albums; verify legacy and neutral responses and the 1–100 limit clamp
- [x] 2.5 Confirm `api/preview.js` needs no provider change (Deezer proxied, Spotify previews absolute); verify an allowed Deezer preview returns 200 and a non-allowlisted host returns 400
- [x] 2.6 Add handler tests in `tests/providers/endpoints.test.mjs` with mocked `fetch` for the neutral and legacy envelopes and the `providers=1` metadata; verify `npm run test:api` passes
- [x] 2.7 Confirm the function count stays at 12 and no new file was added under `api/`; verify with `find api -name '*.js' | wc -l` returning 12

## 3. Spotify adapter

- [x] 3.1 Implement the Spotify Client Credentials token client in `lib/providers/spotify-token.js` (Basic auth, module-scope cache, 60-second early refresh, single retry on 401, `Retry-After` on 429) and add `tests/providers/spotify-token.test.mjs` with mocked `fetch`; verify `npm run test:api` passes
- [x] 3.2 Implement `lib/providers/spotify.js` catalog methods (search, album, album tracks with bounded pagination, artist, top tracks, artist albums, track) and map them to neutral DTOs including `preview_url` passthrough, multiple artists, cover selection and release-date padding; verify with `tests/providers/spotify.test.mjs`
- [x] 3.3 Make Spotify availability depend on `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` only, default `SPOTIFY_MARKET` to `US`, and ensure no secret reaches the client; verify `providers=1` reports Spotify unavailable with the env vars unset and that a production build contains no secret value
- [x] 3.4 Document the Spotify environment variables and market override in `AGENTS.md`; verify the names match `lib/providers/spotify*.js` and the Vercel setup
- [x] 3.5 Implement `lib/providers/itunes.js` (search tracks/albums/artists, album/artist lookup, top tracks, artist albums, track) with artwork upscaling and preview passthrough; add `tests/providers/itunes.test.mjs`; verify `npm run test:api`
- [x] 3.6 Implement `lib/providers/youtube.js`: music video search with `artistId`, cleaned titles and batched durations, artist detail from the channel, top tracks from the uploads playlist sorted by views, album/EP detail from official playlists, official-only playlist filtering and `YOUTUBE_API_KEY` availability; add `tests/providers/youtube.test.mjs`; verify `npm run test:api`
- [x] 3.7 Document `ITUNES_COUNTRY`, `YOUTUBE_API_KEY`, `YOUTUBE_REGION`, YouTube's quota limits, its derived album/artist entities and the iTunes preview behavior in `AGENTS.md` and `.env.example`

## 4. Client catalog layer

- [x] 4.1 Add `src/app/core/catalog/catalog-id.ts` with `parseCatalogId`, `toCatalogId` and provider validation; add `catalog-id.spec.ts` covering namespaced ids, legacy numeric ids, and empty/invalid input; verify the spec passes
- [x] 4.2 Add provider-neutral runtime models and normalization helpers (`provider`, namespaced `id`, `externalId`) for tracks, releases and album tracks; add `normalizeCatalogItem` tests covering missing `provider` defaulting to Deezer; verify the spec passes
- [x] 4.3 Implement `MusicCatalogService` with the provider registry, availability fetch from `GET /api/search?providers=1`, filter-aware search dispatch (the active provider selection was later replaced by the merged catalog), provider-keyed caches and `CatalogError` mapping; add `music-catalog.service.spec.ts` with mocked `fetch`; verify it passes
- [x] 4.4 Rewrite `src/app/core/api/search.service.ts` as a facade over `MusicCatalogService`, keeping the public method names, adding `format=neutral` and `provider` to every request, and replacing `getArtist`'s Deezer return type with the neutral artist model; update `search.service.spec.ts` and verify `ng test --include='**/search.service.spec.ts'`
- [x] 4.5 Replace the direct Deezer fetching and `DeezerAlbum` parsing in `src/app/features/releases/releases.component.ts` with `SearchService`/`MusicCatalogService` calls; update `releases.component.spec.ts` and verify it passes
- [x] 4.6 Document the client catalog layer (`core/catalog/`) and its role in `AGENTS.md`; verify the key-path table and description match the files
- [x] 4.7 Add `itunes` and `youtube` to the client provider labels/defaults, merge server availability with the known four providers, and keep iTunes previews direct and YouTube preview-free; verify `music-catalog.service.spec.ts` and `search.service.spec.ts`
- [x] 4.9 Merge the available catalogs (`CATALOG_MERGE_ORDER`: Deezer then iTunes) into one result list with `catalog-merge.ts` (identity key, name normalization, fill-missing fields) and add `catalog-merge.spec.ts`; verify the same song from both catalogs yields one Deezer-owned entry
- [x] 4.10 Offer YouTube as one more search filter (`video`) instead of a mode: the videos filter runs a single YouTube search and catalog filters never call YouTube; verify `music-catalog.service.spec.ts` asserts each filter only calls its endpoints and the videos filter makes one YouTube request
- [x] 4.8 Add per-provider capabilities (`searchTypes`, `previews`, `albumDetail`, `artistDetail`) and drive the combined search from them, so a provider only calls the endpoints its filter needs; verify `music-catalog.service.spec.ts` asserts a songs/albums/artists filter omits the other endpoints

## 5. Provider selection and navigation

- [x] 5.1 Keep the provider selector out of the search tab; the search tab only uses the active provider and keeps its existing header, state area and favorite-artists layout
- [x] 5.2 Include the active provider in the saved search state (`sessionStorage`) and re-run the current query when the provider changes in Ajustes; verify switching provider replaces results and restoring the session keeps the settings selection
- [x] 5.3 Make external links and share text provider-aware in `search`, `album`, `artist` and `releases` (Deezer vs Spotify URLs) and remove hard-coded `deezer.com` item links; verify with a grep that no item link is built from a hard-coded Deezer host
- [x] 5.4 Parse provider-scoped ids in the `album/:id` and `artist/:id` routes with legacy bare-id fallback, and render a not-found state for an unregistered provider; verify legacy and Spotify routes manually and with a component spec
- [x] 5.5 Add the provider selector to Ajustes for mobile and desktop, sharing the same active provider as the search tab; verify changing it in Ajustes updates the search provider and persists after reload
- [x] 5.6 Remove the Ajustes provider selector, because the catalog is always the merged one, and keep the settings section free of dead state
- [x] 5.7 Add `Vídeos` as the fifth type filter when YouTube is available, run a new search per selected filter so each one fetches its own results, and persist the selection; verify the filter row stays visible for videos and each filter produces its own calls

## 6. Persistence and backward compatibility

- [x] 6.1 Add the optional `provider` field to `WishlistEntry`, `FavoriteArtist`, `Track` and `ReleaseItem` and normalize missing values to `deezer` on read; add model/serialization tests; verify they pass
- [x] 6.2 Persist `provider` in `WishlistService` writes, keep deduplication based on the namespaced id, and keep shared entries provider-scoped; add a `wishlist.service` spec covering legacy documents and two providers sharing an external id; verify it passes
- [x] 6.3 Persist `provider` in `FavoriteArtistsService`, resolve artist images through the catalog service, and treat legacy favorites as Deezer; add a `favorite-artists.service` spec; verify it passes
- [x] 6.4 Verify the new field is accepted by the current Firestore rules (they do not validate fields) by adding a wishlist item and a favorite in demo mode and with a real account; confirm both reads return the provider

## 7. Provider-aware release monitoring

- [x] 7.1 Refactor `api/check-releases.js` to resolve each favorite's provider, group by provider, call `getArtistAlbums` through the adapter, keep per-artist failure isolation, store external ids in the release cache and send the namespaced album id in push payloads; add `tests/providers/release-monitoring.test.mjs` for grouping, cache dedupe and the two-day window; verify `npm run test:api`
- [ ] 7.2 Verify the native notification actions still open the correct album by inspecting `ReleaseMessagingService` and `NativeShellService` for bare-id assumptions and testing "View release" on a real release payload with a namespaced id
- [x] 7.3 Update the push/release-monitoring notes in `AGENTS.md` to describe provider resolution and the cache/id compatibility rule; verify the notes match `check-releases.js`

## 8. Integration verification

- [x] 8.1 Run `npm run build`, `npm test` and `npm run test:api`; verify all three complete without failures
- [x] 8.2 Deploy a Vercel preview and verify 12 functions, `providers=1` availability, legacy Deezer envelopes and neutral envelopes, and Spotify enabled only when the env vars exist
- [ ] 8.3 Manually exercise search, album, artist, preview, wishlist add/remove, shared wishlist and favorite/release flows on web with Deezer and with Spotify active
- [ ] 8.4 Build and install the Android app, then verify Google sign-in, a Spotify item route, a Deezer preview and a release notification action still work
- [x] 8.5 Roll back by removing the Spotify env vars in the preview and verify Spotify becomes unavailable while Deezer and legacy data keep working

## Workflow follow-up

- Archive the change after the verification tasks pass and the project review is approved.
- Bump `package.json` only when the user requests it at a release boundary, following the type of change.
