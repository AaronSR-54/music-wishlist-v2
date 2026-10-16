# Design

## Context

See `proposal.md` — Why. The relevant constraints:

- The native app bundles the web build and loads it from the local WebView origin, so relative
  `/api/...` URLs never reach the backend.
- `apiBaseUrlInterceptor` already rewrites `/api/` requests using `environment.apiBaseUrl`, but it
  only runs for Angular `HttpClient` traffic. Push and account-deletion calls use `HttpClient` and
  already work native.
- The broken paths use raw `fetch()` (`SearchService`, `ReleasesComponent.fetchJson`) and raw
  `/api/preview` URLs fed to `new Audio(...)` in `PreviewService`/components.
- `environment.apiBaseUrl` is `''` in development (proxy handles `/api`) and the deployed URL in
  production.

## Goals / Non-Goals

**Goals:**
- One consistent rule for turning an `/api/...` path into a native-absolute URL, reused by every
  raw-fetch and audio call site.
- Identical web behavior to today (origin-relative URLs).
- Minimal, localized change with unit coverage.

**Non-Goals:**
- Refactoring `SearchService`/`ReleasesComponent` to `HttpClient` (kept as a follow-up option).
- Any backend, endpoint-count, or `apiBaseUrl`/interceptor configuration change.
- Rewriting the preview playback flow itself.

## Decisions

### Decision: A small pure helper `apiUrl(path)` instead of a global fetch wrapper
Add `src/app/core/api/api-url.ts` exporting a function that returns
`environment.apiBaseUrl + path` when `Capacitor.isNativePlatform()` and `environment.apiBaseUrl` is
set, otherwise `path` unchanged. It mirrors the interceptor's exact predicate
(`base && Capacitor.isNativePlatform() && path.startsWith('/api/')`).

- **Why**: The call sites use `fetch()` and set `<audio>` URLs directly; only a plain function can
  be applied to both without changing the data flow. It is trivially unit-testable by spying on
  `Capacitor.isNativePlatform`, like `api-base-url.interceptor.spec.ts` does.
- **Alternatives considered**:
  - *Refactor to `HttpClient` + interceptor*: fixes data calls but the interceptor still cannot
    rewrite an `<audio src>` string, so preview URLs would need a helper anyway; a larger diff for
    no added consistency.
  - *Monkey-patch global `fetch`*: global side effects, hard to test, and does not help `<audio>`.

### Decision: Reuse the helper for preview URLs at their source
`SearchService` builds every `previewUrl`; wrap those with `apiUrl(...)`. `ReleasesComponent` builds
its own preview URLs, so it also uses the helper. `PreviewService` then receives an already-resolved
URL and needs no change. `getTrackPreview` resolves its returned URL the same way.

- **Why**: Resolving at the single point where the URL string is created keeps `PreviewService`
  transport-agnostic and avoids touching the player.
- **Note**: components may embed a `/api/preview?...` URL built by `SearchService`/releases and pass
  it through; those inherit the resolved value. Any locally constructed `/api/preview` URL in a
  component must also go through the helper.

### Decision: Keep the `HttpClient` interceptor for push/account endpoints
No change: those requests already pass through `HttpClient` and the interceptor. The helper is only
for raw `fetch()` and audio URLs.

## Risks / Trade-offs

- **Missed call site** → Grep for `/api/` and `fetch(` and route every one through the helper;
  add a unit test per call-site category (data, album-tracks, preview).
- **Double prefixing if a caller passes an already-absolute URL** → The helper only rewrites paths
  that start with `/api/`, so absolute URLs pass through unchanged; tests cover this.
- **Native detection in tests** → Follow the existing interceptor spec pattern (spy on
  `Capacitor.isNativePlatform`) so behavior is deterministic without a device.

## Migration Plan

Ship inside the normal release: the fix is client-only and has no data migration. Web builds are
unaffected (helper returns the relative path). Rollback is reverting the commit; no backend or
Play-side action required.

## Open Questions

None.
