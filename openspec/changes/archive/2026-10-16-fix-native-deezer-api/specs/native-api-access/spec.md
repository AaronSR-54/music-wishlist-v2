# Spec Delta

## Purpose

Defines how the native app reaches the deployed backend API so that every `/api/*` request —
Deezer-backed data and audio previews alike — resolves against the configured `apiBaseUrl`,
while the web build keeps using origin-relative URLs.

## ADDED Requirements

### Requirement: Native data requests target the configured backend
On a native platform, the app SHALL send every `/api/*` data request to the configured
`environment.apiBaseUrl` instead of the app's local WebView origin, for all Deezer-backed
operations (search, albums, artists, tracks and album tracks).

#### Scenario: Search on native reaches the backend
- **WHEN** the user runs a track, album or artist search in the native app
- **THEN** each request is sent to `<apiBaseUrl>/api/...` and results render in the app

#### Scenario: Detail pages on native reach the backend
- **WHEN** the user opens an artist or album detail page in the native app
- **THEN** its `/api/*` requests are sent to `<apiBaseUrl>` and the page loads its content

### Requirement: Web requests stay origin-relative
On web, the app SHALL keep `/api/*` requests relative to the current origin so they continue to
work through the existing proxy and same-origin deployment.

#### Scenario: Browsing the web build
- **WHEN** the user runs a search or opens a detail page in the browser
- **THEN** the requests use the relative `/api/...` path and are not rewritten to an absolute host

### Requirement: Audio preview URLs resolve to the backend on native
On a native platform, the app SHALL resolve `/api/preview` audio URLs against
`environment.apiBaseUrl` so track previews are fetched from the backend rather than the local
WebView origin. On web, these URLs SHALL remain origin-relative.

#### Scenario: Preview plays on native
- **WHEN** the user plays a track preview in the native app
- **THEN** the audio element loads from `<apiBaseUrl>/api/preview?...` and the preview plays

#### Scenario: Preview still plays on web
- **WHEN** the user plays a track preview in the browser
- **THEN** the audio element uses the relative `/api/preview?...` URL and the preview plays
