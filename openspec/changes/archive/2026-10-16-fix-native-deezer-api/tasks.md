# Tasks

## 1. Shared API URL helper

- [x] 1.1 Create `src/app/core/api/api-url.ts` exporting `apiUrl(path)` that returns
      `environment.apiBaseUrl + path` when `environment.apiBaseUrl` is set, the platform is native
      (`Capacitor.isNativePlatform()`), and `path` starts with `/api/`; otherwise returns `path`
      unchanged (absolute/non-`/api` URLs pass through). Verify by reading the file and confirming
      the predicate matches `api-base-url.interceptor.ts`.
- [x] 1.2 Add `src/app/core/api/api-url.spec.ts` covering: native + `/api/...` → prefixed; web +
      `/api/...` → unchanged; native + empty `apiBaseUrl` → unchanged; native + absolute URL →
      unchanged. Verify with
      `ng test --include='**/api-url.spec.ts' --watch=false`.

## 2. SearchService data and preview URLs

- [x] 2.1 Route the raw `fetch()` data calls in `search.service.ts` (`/search`, `/search/album`,
      `/search/artist`, `/artist`, `/artist-info`, `/artist-albums`, `/album-tracks`, `/track`,
      `/album`) through `apiUrl(...)`. Verify by grepping the file that no `fetch(\`${this.apiUrl}...`
      call remains unwrapped.
- [x] 2.2 Wrap every `previewUrl` built in `search.service.ts` (search tracks, artist tracks,
      artist release singles, album tracks, `getTrackPreview`) with `apiUrl(...)`. Verify by
      grepping the file that each `/api/preview?url=...` string is passed through `apiUrl(...)`.
- [x] 2.3 Add `src/app/core/api/search.service.spec.ts` asserting the native base URL is applied
      to a data call and a preview URL (spy on `Capacitor.isNativePlatform`). Verify with
      `ng test --include='**/search.service.spec.ts' --watch=false`.

## 3. ReleasesComponent album-tracks and preview URLs

- [x] 3.1 In `releases.component.ts`, route `fetchJson` calls (the `/artist-albums` and
      `/album-tracks` requests) and the `/api/preview` URLs it builds through `apiUrl(...)`. Verify
      by reading the file that no raw `/api/...` string or unwrapped `fetchJson(this.apiUrl...)`
      remains.
- [x] 3.2 Add a `releases.component.spec.ts` (or a focused unit test of the URL-building path)
      asserting the native base URL is applied to the `/api` data and preview URLs. Verify with
      `ng test --include='**/releases*.spec.ts' --watch=false`.

## 4. Verification and version

- [x] 4.1 Confirm no raw relative `/api/` call sites remain outside `apiUrl(...)` and the
      `HttpClient`-based push/account services: grep `fetch(` and `/api/` across `src/`.
- [x] 4.2 Run `npm test` (or the relevant includes) and `npm run build`; confirm both pass and the
      production build succeeds.
- [x] 4.3 Bump `package.json` `version` (patch, e.g. `0.22.3` → `0.22.4`) per AGENTS.md and verify
      `src/version.json` regenerates on the next build.

## Workflow follow-up

- Manually verify on a device/emulator that search, artist/album pages and previews work in the
  native app, then archive the change after review.
