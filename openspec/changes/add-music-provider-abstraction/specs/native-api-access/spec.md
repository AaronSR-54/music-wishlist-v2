# Spec Delta

## MODIFIED Requirements

### Requirement: Native data requests target the configured backend
On a native platform, the app SHALL send every `/api/*` catalog request to the configured
`environment.apiBaseUrl` instead of the app's local WebView origin, for all providers and
operations (search, albums, artists, tracks and album tracks).

#### Scenario: Search on native reaches the backend
- **WHEN** the user runs a track, album or artist search in the native app with any active provider
- **THEN** each `/api/*` request is sent to `<apiBaseUrl>/api/...` and results render in the app

#### Scenario: Detail pages on native reach the backend
- **WHEN** the user opens an artist or album detail page in the native app
- **THEN** its `/api/*` requests are sent to `<apiBaseUrl>` and the page loads its content

#### Scenario: Provider parameter survives the native rewrite
- **WHEN** a native catalog request includes a `provider` query parameter
- **THEN** the rewritten URL keeps that parameter and the backend answers for the same provider

### Requirement: Web requests stay origin-relative
On web, the app SHALL keep `/api/*` requests relative to the current origin so they continue to
work through the existing proxy and same-origin deployment.

#### Scenario: Browsing the web build
- **WHEN** the user runs a search or opens a detail page in the browser
- **THEN** the requests use the relative `/api/...` path and are not rewritten to an absolute host

### Requirement: Audio preview URLs resolve to the backend on native
On a native platform, the app SHALL resolve backend-proxied `/api/preview` audio URLs against
`environment.apiBaseUrl`, and SHALL leave already-absolute preview URLs untouched. YouTube videos have
no audio preview and play in the in-app modal instead. On web, backend-proxied preview URLs SHALL remain
origin-relative.

#### Scenario: Preview plays on native
- **WHEN** the user plays a Deezer track preview in the native app
- **THEN** the audio element loads from `<apiBaseUrl>/api/preview?...` and the preview plays

#### Scenario: YouTube video opens on native
- **WHEN** the user taps a YouTube video in the native app
- **THEN** the in-app video modal opens and no audio preview is requested

#### Scenario: Preview still plays on web
- **WHEN** the user plays a Deezer track preview in the browser
- **THEN** the audio element uses the relative `/api/preview?...` URL and the preview plays
