# Proposal

## Why

In the Capacitor Android app, every piece of content backed by the Deezer proxy fails: search
returns nothing, artist and album pages stay empty, and track previews do not play. The app loads
its bundled build from the local WebView origin, so the relative `/api/...` URLs used by
`SearchService` and `ReleasesComponent` resolve against that local origin instead of the deployed
backend. The existing `apiBaseUrlInterceptor` already rewrites `/api/` requests to
`environment.apiBaseUrl` on native, but it only applies to Angular `HttpClient` requests, and these
services call raw `fetch()` (and set raw `/api/preview` audio URLs), so they bypass it entirely.
Push notifications and other `HttpClient` calls already work on native, which is why the breakage
looks specific to Deezer content.

## What Changes

- Add a single shared helper that resolves an `/api/...` path to an absolute URL on native (using
  `environment.apiBaseUrl`) and leaves it relative on web, mirroring the existing interceptor rules.
- Route every Deezer-backed data call in `SearchService` through the helper instead of using raw
  relative `fetch()` URLs.
- Route the `ReleasesComponent` album-tracks fetch through the same helper.
- Resolve the `/api/preview` audio URLs (search results, artist tracks, album tracks, releases,
  `getTrackPreview`) with the helper so preview playback works on native.
- Leave web behavior unchanged: on web the helper returns the same relative URLs as today.
- No change to backend endpoints (still 12/12), to the Deezer proxy contract, or to the
  `HttpClient` interceptor for `/api/push`.

## Capabilities

### New Capabilities
- `native-api-access`: How the native app reaches the deployed backend API — every `/api/*` request,
  including Deezer data and audio previews, must target the configured `apiBaseUrl` on native while
  remaining origin-relative on web.

### Modified Capabilities
<!-- None: the interceptor behavior is unchanged; a new capability captures the unified rule. -->

## Impact

- **Code**: `src/app/core/api/search.service.ts`, `src/app/features/releases/releases.component.ts`,
  a new shared helper (e.g. `src/app/core/api/api-url.ts`), and its unit tests.
- **No backend change**: no new `api/*.js` files; the 12-endpoint limit is unaffected.
- **No dependency or configuration change**: `environment.apiBaseUrl` and the existing interceptor
  stay as they are.
