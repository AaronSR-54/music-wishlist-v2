# Proposal

> **Decision update (2026-11-13):** the abstraction ships with exactly two providers.
> Deezer is the whole searchable catalog (artists, tracks, albums, EPs) and YouTube only powers
> the `Vídeos` filter; videos open in an in-app preview modal. Spotify and iTunes were removed
> (adapters, availability, env vars and tests) before release, so the Spotify/iTunes material
> below is historical rationale, not the shipped behavior. Ranking (`catalog-rank.ts`) and
> saved-artist injection were added on top of the single Deezer catalog.

## Why

Music catalog access is hard-wired to Deezer at every layer: `SearchService` maps Deezer
response shapes inline, `ReleasesComponent` parses `DeezerAlbum` directly, routes and Firestore
documents store bare Deezer ids, and all 12 serverless endpoints call `api.deezer.com`. Adding
Spotify or YouTube Music today would copy that mapping, caching and endpoint logic per provider,
and the Vercel free plan caps the project at 12 API endpoints, so new providers cannot get their
own routes. The catalog layer must become provider-neutral before a second API is added.

## What Changes

- Add a server-side **provider adapter** contract and move provider-specific URL building and
  response normalization into shared modules under `lib/providers/` (not `api/`, so they do not
  count against the 12-endpoint limit).
- Extend the **existing** endpoints with a `provider` query parameter (default `deezer`) instead
  of creating new endpoints: `search`, `search/album`, `search/artist`, `album`, `album-tracks`,
  `artist`, `artist-info`, `artist-albums`, `track`, `preview`, `check-releases`.
- Add a client-side `MusicCatalogService` that owns the provider registry, provider-neutral
  models, caching and request dispatch. `SearchService` keeps its public methods as a facade so
  feature components do not need to change their call sites.
- Introduce **provider-scoped identifiers** (`<provider>:<externalId>`) with parse/serialize
  helpers. Legacy ids without a provider prefix resolve to `deezer`, so existing routes,
  wishlist entries, favorite artists and shipped links keep working.
- Persist `provider` on wishlist entries, favorite artists and cached release/session state.
  Legacy Firestore documents without the field are read as `deezer`; no data migration.
- Add an active-provider selector in Ajustes (Perfil → Configuración), persisted in
  `localStorage`; the search tab and detail navigation use the selected provider without adding
  their own selector.
- Implement **Spotify** as the second provider using the Client Credentials flow (server-side,
  env `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`). When the credentials are absent, Spotify
  reports itself unavailable and the UI keeps working with Deezer alone.
- Implement **iTunes** as a third provider using the free iTunes Search API (no credentials).
  It supports track/album/artist search, album and artist details, and 30-second previews.
- Implement **YouTube** as a fourth provider using the YouTube Data API v3 (env
  `YOUTUBE_API_KEY`). It supports track search and metadata only: results link out to YouTube and
  have no audio previews or album/artist detail pages.
- Make release monitoring provider-aware: `check-releases` reads each favorite artist's
  `provider` and calls the matching adapter.
- **Out of scope:** the YouTube Music catalog itself (it has no official public API). The YouTube
  provider searches music videos through the official YouTube Data API and is link-only.

No breaking changes: existing Deezer ids, data and routes remain valid.

## Capabilities

### New Capabilities

- `music-catalog`: provider-neutral catalog access (search, album, artist, tracks, previews,
  release listing), provider registry and availability, active provider selection, Deezer,
  Spotify, iTunes and YouTube behavior, graceful degradation when a provider is unconfigured or
  fails.
- `music-item-identity`: provider-scoped item identity for tracks, albums and artists across
  routes, wishlist entries, favorite artists and session state, including backward compatibility
  for legacy Deezer ids.

### Modified Capabilities

- `native-api-access`: generalize the requirement that native `/api/*` requests target
  `environment.apiBaseUrl` from "Deezer-backed operations" to catalog operations for every
  provider, including provider-hosted preview URLs (Spotify, iTunes).

## Impact

- **API**: `api/search.js`, `api/search/album.js`, `api/search/artist.js`, `api/album.js`,
  `api/album-tracks.js`, `api/artist.js`, `api/artist-info.js`, `api/artist-albums.js`,
  `api/track.js`, `api/preview.js`, `api/check-releases.js`. Endpoint count stays at 12.
- **New shared server code**: `lib/providers/` (contract, Deezer adapter, Spotify adapter,
  Spotify token cache, iTunes adapter, YouTube adapter, availability) imported by the endpoints
  above.
- **Client**: new `src/app/core/catalog/` (provider contract, catalogue service, id helpers);
  `src/app/core/api/search.service.ts` becomes a facade; `src/app/core/services/preview.service.ts`,
  `src/app/core/firebase/wishlist.service.ts`, `wishlist-entry.model.ts`,
  `favorite-artists.service.ts`, `favorite.artist.model.ts`, `search.component.ts`,
  `releases.component.ts`, `album.component.ts`, `artist.component.ts`,
  `search-result-item.component.ts`, `src/app/shared/models/track.model.ts`,
  `src/app/shared/models/release-item.model.ts`.
- **Config**: `scripts/set-env.js` (optional provider flags for the client), Vercel env vars for
  `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, `YOUTUBE_API_KEY` (plus optional
  `ITUNES_COUNTRY`, `YOUTUBE_REGION`, `SPOTIFY_MARKET`), `proxy.conf.json` unchanged.
- **Tests**: `search.service.spec.ts`, `api-url.spec.ts`, plus new specs for id helpers and the
  provider registry; unit tests for adapter normalization.
- **Data**: Firestore documents gain an optional `provider` field; legacy documents read as
  `deezer`. No migration script.
- **Dependencies**: none added; uses `fetch` and the existing Node/Vercel runtime.
