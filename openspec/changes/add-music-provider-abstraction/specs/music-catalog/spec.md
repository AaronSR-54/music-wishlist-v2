# Spec Delta

## Purpose

Defines how the app reads music catalog data through a provider-neutral contract. Deezer is the
only searchable catalog (artists, tracks, albums and EPs); YouTube backs the `Vídeos` filter only.
Both share one search, detail and preview behavior instead of duplicating mapping, caching and
endpoint logic.

## ADDED Requirements

### Requirement: Provider-neutral catalog results
The system SHALL return search results, album details, artist details, track lists and previews
through a single provider-neutral model, independent of which provider supplied the data.

#### Scenario: Searching yields the same shape
- **WHEN** the user searches for a track, album or artist
- **THEN** every result exposes the same fields (name, artists, cover, type, provider-scoped id)
  and the UI renders it without provider-specific branching

#### Scenario: Album and artist detail render from a detail-capable provider
- **WHEN** the user opens a Deezer album or artist result
- **THEN** the page loads header data, tracks and links through the same model

### Requirement: Provider registry and availability
The system SHALL expose the registered providers with an availability status, and SHALL report a
provider as available only when its required configuration is present.

#### Scenario: Deezer is always available
- **WHEN** the app starts without any provider configuration
- **THEN** Deezer is listed as available and is usable

#### Scenario: YouTube without an API key
- **WHEN** `YOUTUBE_API_KEY` is not configured on the server
- **THEN** YouTube is reported as unavailable and the videos filter is not offered

#### Scenario: Removed providers are not registered
- **WHEN** a client asks for Spotify or iTunes provider status or data
- **THEN** they are not listed and requests naming them fail with a client error

### Requirement: One catalog provider, videos as a filter
The system SHALL search only Deezer for artists, tracks, albums and EPs, SHALL keep distinct
records that share a name (Deezer has several different artists named "Iban"), and SHALL offer
YouTube as one more search filter (`Vídeos`) instead of a separate mode.

#### Scenario: Catalog searches query Deezer only
- **WHEN** the user searches without the videos filter
- **THEN** only Deezer is queried and no YouTube quota is spent

#### Scenario: Distinct same-name records stay visible
- **WHEN** Deezer returns two different artists or items with the same normalized name
- **THEN** both entries are shown, because they are different records

#### Scenario: Videos are one more filter
- **WHEN** the user selects the `Vídeos` filter in the search tab
- **THEN** only YouTube is queried, with a single search call, and Deezer is not queried

#### Scenario: The videos filter is hidden without YouTube
- **WHEN** `YOUTUBE_API_KEY` is not configured on the server
- **THEN** the videos filter is not offered and the catalog keeps working

### Requirement: Search ranking
The system SHALL rank results by name-match quality first and audience second, so an exact name
match with real repercussion wins while a massively followed prefix match can still beat an
obscure exact match.

#### Scenario: Exact matches come first
- **WHEN** results include an exact name match and a prefix match
- **THEN** the exact match ranks first unless the prefix match has roughly 10,000× the audience

#### Scenario: Audience breaks equal matches
- **WHEN** two results have the same name-match quality
- **THEN** the one with more followers/albums ranks first, and ties keep the provider order

#### Scenario: Unmatched popular items do not win
- **WHEN** a hugely followed artist does not match the query at all
- **THEN** it ranks below any name match, including a fuzzy typo match

#### Scenario: Saved artists are findable
- **WHEN** the user searches for a favorite artist that the provider index does not return
- **THEN** the saved artist is injected into the results and boosted above comparable records

### Requirement: Deezer behavior remains the default
The system SHALL keep every existing Deezer-backed search, detail and preview behavior available
without additional configuration.

#### Scenario: Existing Deezer flow still works
- **WHEN** the user searches, opens an album or artist, or plays a preview with Deezer active
- **THEN** results, details and previews behave as they did before this change

### Requirement: YouTube catalog access
When YouTube is available, the system SHALL support video search from official YouTube music
videos, SHALL resolve each result's channel as the artist, and SHALL NOT expose audio previews.

#### Scenario: YouTube search
- **WHEN** the user searches with the videos filter
- **THEN** music video results are returned as `video` entries with cover art, cleaned title,
  duration, artist link and a YouTube link

#### Scenario: Videos are a filter, not a mode
- **WHEN** the videos filter is active
- **THEN** the type filter row stays visible with the same options, so the user can switch back to
  artists, songs, albums or EPs without a second control

#### Scenario: YouTube details stay reachable
- **WHEN** the user opens a YouTube channel or playlist route directly
- **THEN** its name, avatar, uploads and ordered track list render through the same model

#### Scenario: YouTube is unavailable without a key
- **WHEN** the YouTube Data API key is missing
- **THEN** the videos filter is hidden and the Deezer catalog keeps working

### Requirement: Video preview modal
The system SHALL play a selected video in an in-place modal instead of opening a new tab.

#### Scenario: Clicking a video result
- **WHEN** the user clicks a video result in search or wishlist
- **THEN** a mobile-style sheet opens with the embedded YouTube player, the video title and artist,
  and a link to open it on YouTube

#### Scenario: Closing the video modal
- **WHEN** the user clicks the backdrop, the close button or presses Escape
- **THEN** the modal closes and playback stops

### Requirement: Provider-aware preview playback
The system SHALL resolve each audio preview through Deezer and SHALL treat a track without a
preview as playable-less rather than as an error.

#### Scenario: Deezer preview
- **WHEN** the user plays a Deezer track with a preview
- **THEN** the audio loads through the existing backend preview proxy

#### Scenario: YouTube has no preview
- **WHEN** the user selects a YouTube video
- **THEN** no audio preview is offered and the video opens in the preview modal

#### Scenario: No preview available
- **WHEN** the user selects a track whose provider returns no preview URL
- **THEN** the player reports that no preview is available and the rest of the app keeps working

### Requirement: Provider failure isolation
The system SHALL isolate a provider's failure or timeout so it does not break the rest of the
app.

#### Scenario: A catalog request fails
- **WHEN** the Deezer search fails
- **THEN** the search shows an error state and the rest of the app keeps working

#### Scenario: A delete/refresh path fails
- **WHEN** release monitoring cannot reach one favorite artist's provider
- **THEN** releases from other artists and providers still load

### Requirement: Provider-aware release monitoring
The system SHALL list an artist's albums using the provider stored for that favorite artist, and
SHALL treat favorite artists without a stored provider as Deezer.

#### Scenario: Releases for a Deezer favorite
- **WHEN** the daily release check runs for a favorite artist saved with the Deezer provider
- **THEN** it queries Deezer for that artist's albums and notifies about new releases

#### Scenario: Legacy favorite artist
- **WHEN** a favorite artist document has no provider field
- **THEN** its releases are fetched from Deezer as before

### Requirement: Filters drive the search calls
The app SHALL build the filter row from the catalog kinds plus `Vídeos` when YouTube is available,
SHALL persist the selected filter with the saved search state, and SHALL NOT show a provider
selector in settings.

#### Scenario: Selecting a filter fetches its results
- **WHEN** the user selects a filter
- **THEN** a new search runs that only calls the endpoints able to return that kind, so the
  filtered list is fresh and type-specific instead of trimmed from the previous result list

#### Scenario: Filtering by songs, albums or artists
- **WHEN** the user selects Songs
- **THEN** only the track search runs; Albums/EPs call the album search and Artists calls the
  artist search, without the other calls

#### Scenario: Filtering by videos
- **WHEN** the user selects Videos
- **THEN** a single YouTube search runs and no catalog endpoint is called

#### Scenario: Persisted filter
- **WHEN** the user reloads the app after choosing a filter
- **THEN** the saved filter is restored with its results

#### Scenario: Settings no longer selects a provider
- **WHEN** the user opens Ajustes
- **THEN** there is no provider selector, because the catalog is always Deezer

### Requirement: Existing API routes carry the provider
The system SHALL select the provider through the existing `/api/*` catalog routes, and SHALL
reject an unknown provider with a client error instead of falling back silently.

#### Scenario: Provider passed to an existing route
- **WHEN** a catalog request includes a `provider` parameter
- **THEN** the matching provider adapter answers the request without a new serverless function

#### Scenario: Unknown provider
- **WHEN** a request names a provider that is not registered or not configured
- **THEN** the endpoint responds with a 4xx error and does not return Deezer data under that name
