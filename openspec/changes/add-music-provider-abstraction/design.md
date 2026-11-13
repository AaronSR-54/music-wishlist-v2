# Design

> **Decision update (2026-11-13):** the abstraction ships with exactly two providers.
> Deezer is the whole searchable catalog (artists, tracks, albums, EPs) and YouTube only powers
> the `Vídeos` filter; videos open in an in-app preview modal. Spotify and iTunes were removed
> (adapters, availability, env vars and tests) before release, so the Spotify/iTunes material
> below is historical rationale, not the shipped behavior. Ranking (`catalog-rank.ts`) and
> saved-artist injection were added on top of the single Deezer catalog.

## Context

See `proposal.md` for motivation. The relevant current state:

- `SearchService` is the single client entry point for catalog data, but it fetches each Deezer
  endpoint directly, casts raw Deezer payloads and maps them inline. `getArtist()` leaks
  `DArtistResponse` to callers.
- `ReleasesComponent` bypasses `SearchService` and parses `DeezerAlbum` payloads itself;
  `check-releases.js` also calls Deezer directly.
- Routes `/album/:id` and `/artist/:id`, wishlist documents and favorite-artist documents store
  bare Deezer ids.
- All 12 Vercel functions are in use (free-plan limit). `api/*.js` files are ESM and import
  nothing shared today; `firebase-admin` is deliberately avoided.
- Firestore rules do not validate document fields, so adding a `provider` field needs no rule
  change.
- The app is Angular 20 standalone with signals and `OnPush`, and ships on web and Capacitor
  Android/iOS.

## Goals / Non-Goals

**Goals:**

- One server adapter boundary and one client catalog boundary, so adding a provider is a new
  adapter plus a registry entry, not a new endpoint or a new mapping block per component.
- Keep the API surface at 12 functions and keep every existing Deezer behavior working.
- Keep legacy ids, Firestore documents and deep links valid with zero migration.
- Ship Spotify, iTunes and YouTube as selectable providers, with availability derived from
  server configuration, so users can switch source without changing the rest of the app.

**Non-Goals:**

- The YouTube Music catalog itself (no official API). The YouTube provider searches music videos
  through the official YouTube Data API and is link-only.
- Merging results from multiple providers in one search. Exactly one provider is active.
- Spotify user OAuth, playlists, saved albums or full-track playback. Only public catalog data
  and 30-second previews are used.
- Album/artist detail pages for YouTube. Those results are track-only and link out.
- Changing the search UI layout; the provider selector lives in Ajustes only. Detail pages keep
  their current structure.
- Server-side catalog caching beyond the existing HTTP cache headers.

## Decisions

### 1. Server adapter contract in `lib/providers/`

Each provider exports an adapter object with a fixed shape:

```
id, isConfigured(),
searchTracks(q, limit), searchAlbums(q, limit), searchArtists(q, limit),
getAlbum(id), getAlbumTracks(id), getArtist(id), getArtistTopTracks(id),
getArtistAlbums(id, limit), getTrack(id)
```

Every method resolves to a **provider-neutral DTO** already shaped like the client models,
including `provider`, `externalId`, namespaced `id`, cover, type and optional preview URL. Raw
provider payloads never leave the adapter.

The existing endpoints become thin: parse `provider` (default `deezer`), call
`getProvider(id, { requireConfigured: true })`, map the adapter result to a JSON envelope, set
cache/CORS headers. An unknown or unconfigured provider returns 400/503; an upstream failure
returns 502.

To keep already-installed clients (PWA caches, Capacitor builds) working during rollout, the
endpoints keep returning the **legacy Deezer payload** when the request omits a format flag, and
return the provider-neutral payload when it sends `format=neutral`. The new client always sends
`format=neutral`; non-Deezer providers always answer in neutral form. This costs one branch per
handler and removes the need for a synchronized client/server release.

Shared code lives in `lib/providers/` at the repository root, not in `api/`, because files under
`api/` are deployed as functions. Vercel's Node builder traces imports outside `api/`, so this
keeps the endpoint count at 12. The shared modules are **CommonJS** (`.js`, `module.exports`):
Vercel compiles `api/*.js` to CommonJS, so importing an ES module (`.mjs`) fails at runtime with
`ERR_REQUIRE_ESM`. A deploy preview confirmed this and the CJS layout fixes it.

*Alternative considered:* one endpoint per provider. Rejected by the 12-function limit.
*Alternative considered:* provider `switch` inside each endpoint. Rejected: it recreates the
duplication this change removes.

### 2. Spotify via Client Credentials

The Spotify adapter obtains an app token from
`https://accounts.spotify.com/api/token` using `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
(Basic auth), caches `{ accessToken, expiresAt }` in module scope, and refreshes 60 seconds
before expiry. `isConfigured()` is true only when both env vars exist. A 401 invalidates the
cached token and retries once; a 429 returns the upstream error with `Retry-After` surfaced as
503 to the client.

Mapping rules:

- `search` → `/v1/search?type=track,album,artist&limit=10&market=${SPOTIFY_MARKET ?? 'US'}`.
- Album tracks follow pagination (`next`) with a hard page cap to bound runtime.
- `album_type` maps `album` → album, `single` → single, `compilation`/`ep` → album/ep by name
  heuristic consistent with the existing Deezer `record_type` mapping.
- `release_date` with `release_date_precision` `year`/`month` is padded to `YYYY-01-01` /
  `YYYY-MM-01` so the existing year/month release filter keeps working.
- Cover art picks the largest image at or below 640px, falling back to the largest available.
- `preview_url` is passed through when present and omitted when null.

*Alternative considered:* Authorization Code + PKCE per user. Rejected: the app needs no
user-scoped Spotify data, and it would add a login flow and token storage.

### 3. Client `MusicCatalogService` with `SearchService` as a facade

New `src/app/core/catalog/` contains:

- `catalog.models.ts` — `CatalogProviderId`, `CatalogError`, `CatalogAvailability`, and
  provider-neutral `CatalogItem`/`CatalogArtist`/`CatalogAlbum`/`CatalogTrack` types.
- `catalog-id.ts` — `parseCatalogId`, `toCatalogId`, `withProvider`.
- `music-catalog.service.ts` — provider registry, `availableProviders` computed, filter-aware
  search dispatch (only the endpoints a filter needs), and provider-keyed caches.
- `catalog-merge.ts` — identity key, name normalization and the merge that turns the Deezer and
  iTunes result groups into one list.
- `catalog-http.ts` — builds `/api/...?provider=...` URLs through the existing `apiUrl()` helper,
  maps 4xx/5xx bodies to `CatalogError`.

`SearchService` keeps its public methods and return types where possible and delegates to
`MusicCatalogService`. This limits the diff to `SearchService` plus the components that relied on
Deezer-specific types (`getArtist` and the releases parsing). Fully renaming `SearchService` was
rejected because 8 components and 4 services inject it.

Provider availability is fetched once from the existing search endpoint in metadata mode:
`GET /api/search?providers=1` returns `{ providers: [{ id, available }] }`. No new function is
created. The client caches the response for the session and falls back to Deezer-only if the
request fails.

*Alternative considered:* build-time env flags for availability. Rejected: it duplicates server
configuration and cannot reflect Vercel runtime env changes without a rebuild.

### 4. Identity format and compatibility

Identity is `<provider>:<externalId>` (`deezer:6516139`, `spotify:4uLU6hMCjMI75M1A2tKUQC`).
`parseCatalogId` treats a value without a colon as `deezer`, and `toCatalogId` rejects empty
external ids. Provider ids match `[a-z0-9-]+`, so splitting on the first colon is unambiguous.

The client normalizes every object at its boundary (`withProvider`), so legacy objects stored
before this change gain `deezer` in memory without being rewritten. Writes always persist
`provider` alongside `trackId`/`albumId`/`artistId`, which are already namespaced.

*Alternative considered:* separate `provider` + `externalId` columns everywhere. Rejected: it
requires touching every comparison, route and Firestore read; the namespaced string keeps
existing equality checks working (wishlist dedupe uses `trackId`).

### 5. Previews

Deezer previews keep flowing through `/api/preview` (allowlist unchanged) so the native rewrite
and cache headers stay intact. Spotify preview URLs are absolute `https://p.scdn.co/...` and are
returned as-is: an `<audio>` element does not need CORS, and proxying would add bandwidth for a
30-second clip. When `preview_url` is null, the player surfaces "no preview available" and the
external link remains the fallback.

*Alternative considered:* allowlist `scdn.co` in `/api/preview` and proxy Spotify too. Rejected
for this change; it is a one-line follow-up if a provider starts sending non-direct URLs.

### 6. Release monitoring

`check-releases.js` resolves each favorite's provider (missing → `deezer`), groups favorites by
provider, and calls `getArtistAlbums(externalId, 50)` through the adapter. Per-artist `try/catch`
keeps one provider failure from aborting the run.

The Firestore cache keeps storing **external ids** (unchanged for Deezer), so already-notified
albums are not re-sent after the upgrade. The push payload keeps `albumId` but now carries the
namespaced id, so the existing native "view release" action opens `/album/<namespaced id>`
without changes to `ReleaseMessagingService`.

### 7. Provider-neutral models

`Track`, `ReleaseItem`, `AlbumTrack` and `WishlistEntry` gain `provider: CatalogProviderId`
(optional on stored documents, required in runtime models after normalization). `Track.uri`
becomes the provider deep link; components that build external links use a provider map
(`deezer.com`, `open.spotify.com`) instead of hard-coded Deezer URLs.

### 8. One merged catalog and videos as a filter

The search tab has one filter row instead of a provider selector:

- **Artistas / Canciones / Álbumes / EPs**: query every available provider in
  `CATALOG_MERGE_ORDER` (`deezer`, `itunes`) and merge the results. Ajustes no longer selects a
  provider.
- **Vídeos**: queries YouTube only with a single search call and marks its results as `video`.

Each filter runs a new search that calls only the endpoints able to produce that kind: Songs calls
`/search`, Albums/EPs call `/search/album`, Artists calls `/search/artist`, and Videos calls
YouTube. Filtering therefore fetches a fresh, type-specific list instead of trimming the previous
one, and the no-filter search is the only one that queries all three catalog endpoints.

Merging is deterministic: the first catalog in priority order owns the item's `id` and
`provider`; later catalogs only fill fields the winner lacks (preview, cover, artist/album link,
fan/album counts). Identity is `type + normalized name + main artist`, ignoring case, accents,
punctuation and edition markers, so "Random Access Memories" matches its deluxe edition while
"(Remix)" and "- Live" stay separate. Keeping Deezer first is what makes ids stable between
searches, so the wishlist and favorites do not accumulate duplicates of the same song.

The selected filter is stored with the saved search state, so reloading restores the same filter
and results. Videos use the `video` type, which is part of the merge key: a video never collapses
with the same song from the catalog.

*Alternative considered:* merging at the identity layer (favorites and release monitoring querying
both catalogs). Rejected for now: it needs canonical artist ids and a migration, while merging the
search results already gives a single catalog experience.

### 9. iTunes adapter

The iTunes Search API is free and needs no credentials. The adapter uses:

- `/search?media=music&entity=song|album|musicArtist` for search, with `ITUNES_COUNTRY`
  (default `US`).
- `/lookup?id=<id>&entity=song|album` for album/artist details and artist albums/top tracks.
- `wrapperType` (`track`, `collection`, `artist`) selects the result kind.
- `artworkUrl100` is upscaled to `600x600bb`; `trackTimeMillis` becomes seconds;
  `trackCount` plus the collection name decide `single`/`ep`/`album`.
- `previewUrl` is passed through as an absolute URL (direct playback, no proxy).
- The Search API returns no artist artwork. `searchArtists`/`getArtist` resolve it in two free
  steps: the Deezer artist picture for an exact normalized name match (preferring the most
  followed entry), then the artist's most relevant album cover from a single batched
  `lookup?id=<ids>&entity=album&limit=1` call. Pictures are cached for 10 minutes and covers for
  24 hours; a failed enrichment never fails the artist request.
- Apple returns duplicate artist records with different ids and the same name; `searchArtists`
  keeps the first one.

iTunes has no configuration gate, so it is always available.

### 10. YouTube adapter (metadata + links)

The YouTube Data API v3 is used with `YOUTUBE_API_KEY` and `YOUTUBE_REGION` (default `US`). There
are no native artist/album/EP entities, so they are derived:

- **Track = video.** `/search?part=snippet&type=video&videoCategoryId=10` returns music videos,
  mapped to `type: 'track'` with the channel as artist, `artistId = youtube:<channelId>`, a cleaned
  title (channel prefix and "Official Audio/Video" suffixes removed), the thumbnail, the duration
  from a batched `videos.list` and `youtube.com/watch?v=<id>` as `uri`.
- **Artist = channel.** `channels.list` (1 unit) returns name, avatar, banner, subscriber count and
  the uploads playlist. `getArtistTopTracks` reads that playlist (1 unit) plus a batched
  `videos.list` (1 unit) for durations and view counts, drops non-music categories and sorts by
  views. "Artist - Topic" channels lose the suffix for display.
- **Album / EP = playlist.** `playlists.list` (1 unit) gives the title, channel, item count and
  date; `playlistItems.list` (1 unit) gives the ordered tracks, with `position` as track number.
  The item count decides `single` (1), `ep` (2–6) or `album` (7+), overridden by an "EP" title.
- **Official-only filtering.** A playlist is kept when its channel ends in VEVO/`- Topic` or matches
  the search term, and its title is not a compilation, video collection or mix. Fan-made
  "full album" uploads are dropped unless the channel is official.
- **`searchTypes = ['track']`.** A combined search would cost three 100-unit queries per keystroke,
  so YouTube only returns tracks in search; albums and artists are reached from a result and from
  the artist page. YouTube is queried only when the videos filter is selected.
- **No previews.** `previewUrl` is never set and the UI opens the YouTube link instead.
- **Artist navigation.** The artist name in a result is a link whenever the item carries an
  `artistId`, for every provider, so a YouTube track leads to its channel page. Album titles are
  cleaned of the "Artist - " prefix, the "Album"/"Official Album Playlist" suffix and the
  `Artist 'Album'` quoting.

Quota is the main constraint: `search.list` costs 100 units and every other call 1 unit, against
the default 10,000/day. The adapter caches the 100-unit calls for 10 minutes in each warm Lambda
and batches video lookups (50 ids per call).

## Risks / Trade-offs

- **iTunes rate limits** → the Search API can throttle bursts (~20 requests/minute per IP).
  Mitigation: no prefetching beyond the existing search, a 10-result search cap and no extra
  album-track calls for every single. A 403 is surfaced as a provider error without breaking
  Deezer.
- **YouTube quota and ToS** → searches cost 100 units of the 10,000/day default quota, and no
  audio can be played from a video. Mitigation: link-only results, no previews, a 10-minute cache
  for 100-unit calls, batched video lookups and a track-only search. The provider is hidden when
  `YOUTUBE_API_KEY` is absent.
- **YouTube has no real album/EP entities** → they are inferred from official playlists and their
  item count. Mitigation: trust only VEVO/artist/Topic channels, reject compilation and video
  playlists, and label the result with the count heuristic instead of claiming an official type.
- **YouTube track numbers and release dates are approximate** → `position` is the playlist order
  and `publishedAt` is the upload date, not the record's release date. The release monitor only
  notifies playlists published in its two-day window, so old albums are not announced.
- **iTunes artist images** → the Search API does not return artist artwork, so artist cards fall
  back to the existing placeholder cover.
- **Spotify requires the app owner to have an active Premium subscription** → with Client
  Credentials and a free owner account, Spotify returns `403 Active premium subscription
  required for the owner of the app`. Mitigation: keep `SPOTIFY_*` unset so the provider stays
  unavailable and Deezer keeps working; enable it only when a Premium owner is available. This is
  a Spotify policy, not a code path.
- **Spotify previews are frequently null** → many Spotify tracks will not play. Mitigation: show
  the existing "no preview" state, keep the external link, and do not treat it as an error.
- **Spotify rate limits** (Client Credentials rolling window) → token cache, bounded pagination,
  no prefetch storms. Release monitoring is capped at `FETCH_CONCURRENCY` and one album page per
  artist. On 429 the adapter propagates `Retry-After` and the run skips that artist.
- **Vercel runtime module format** → the first preview failed with `ERR_REQUIRE_ESM` because the
  functions compile to CommonJS; the provider modules are now `.js`/CommonJS and a preview
  verified all catalog endpoints. If Vercel stops tracing root `lib/`, move the modules to
  `api/_lib/` and confirm they are not exposed as functions (keeping the 12-endpoint limit).
- **Namespaced ids change route strings** → legacy bare ids still resolve, but links shared after
  the upgrade only work on updated clients. Acceptable: the app is a SPA with a single deployed
  version; no public API consumers exist.
- **Colon in Firestore doc ids** → Firestore allows `:` but not `/`; external ids from all three
  providers are URL-safe. Cache keys stay `..._${externalId}` to remain stable.
- **Spotify market affects top tracks and search** → `SPOTIFY_MARKET` defaults to `US`; this is a
  product choice that can be changed without a code change.
- **Firestore documents written by older clients** → the app ignores unknown fields and
  normalizes missing `provider` to Deezer, so mixed-version rollouts are safe.

## Migration Plan

1. Deploy the server adapters and endpoint changes first. With no `SPOTIFY_*` env vars, every
   endpoint behaves exactly as before (Deezer default); adding the env vars enables Spotify.
2. Deploy the client. Legacy ids, documents and routes resolve to Deezer; new writes include
   `provider`.
3. Rollback is a normal revert of the deployment. Documents written with `provider` remain
   readable by the previous client because it ignores unknown fields and keeps using
   `trackId`/`albumId` numbers; only Spotify items become unusable, which is expected when the
   feature is removed.
4. No Firestore migration or index change is required.

## Open Questions

- None. The YouTube metadata question is resolved: the provider uses YouTube Data API v3 and stays
  link-only.
