# AGENTS.md

## Commands
```bash
npm start              # dev server at localhost:4200 (uses proxy.conf.json)
npm run build          # production build → dist/music-wishlist-v2/browser/
npm test               # Karma/Jasmine unit tests
ng test --include='**/wishlist.service.spec.ts'  # single test file
npm run android        # Capacitor: sync android version from package.json + build signed AAB + mapping.txt
npm run android:assets # Regenerate the Android launcher icon + splash from public/icon.svg (@capacitor/assets)
npm run store:screenshots  # Play listing: capture 1080x1920 phone screenshots (Playwright, demo; STORE_CAPTURE_LANG=en|es)
npm run store:feature      # Play listing: regenerate the 1024x500 feature graphic from the brand assets
```
**Note:** Demo mode is activated via `?demo` query param or the demo login (`demo` / `1234`) on the login screen (persists in `localStorage` as `demo-mode`); no separate npm script. `prestart` and `prebuild` both run `scripts/generate-version.js`; `prebuild` also runs `scripts/set-env.js`.

## Versioning

**Do not bump the version automatically.** The version in `package.json` is bumped **only when the user explicitly asks for it**. That request happens at a release boundary: after a production deploy, or when shipping a new mobile (Android) version. Never change `package.json` `version` on your own initiative, and never bump it just because you made a change or are about to commit.

When the user does ask, the version follows the SemVer pattern `major-minor-micro` (`X.Y.Z`), bumped according to the kind of change:

| Change type | Number to bump | Example |
|-------------|---------------|---------|
| `fix:`, `perf:`, `refactor:`, `chore:`, docs, styles | 3rd (micro / patch) | `0.10.0` → `0.10.1` |
| `feat:`, `update:` | 2nd (minor) | `0.10.0` → `0.11.0` |
| `BREAKING CHANGE`, `feat!:`, breaking refactors | 1st (major) | `0.10.0` → `1.0.0` |

Rules:
- Bump the highest-order number that applies and **reset every lesser number to `0`** (minor bump `0.10.0` → `0.11.0`; major bump `0.10.0` → `1.0.0`).
- When several changes are grouped, use the most significant change type for the bump.
- Only bump when the user requests it (post-prod-deploy or new mobile release); otherwise leave `version` untouched.
- `scripts/generate-version.js` writes `src/version.json` from `package.json` on `prebuild`/`prestart`, so never edit `src/version.json` manually.

## Architecture
Angular 20 SPA deployed on Vercel (free plan: max 12 serverless endpoints). Uses `@angular/build:application` builder (standalone bootstrap, no NgModules).

### API endpoints (currently 12 — at the Vercel free-plan limit)
`api/search.js`, `api/search/album.js`, `api/search/artist.js`, `api/push.js`, `api/check-releases.js`, `api/album.js`, `api/album-tracks.js`, `api/track.js`, `api/preview.js`, `api/artist.js`, `api/artist-info.js`, `api/artist-albums.js`.

**Do not create new api/*.js files** unless strictly necessary — reuse existing endpoints via actions/parameters. Currently at 12/12 limit.

Vercel cron runs `api/check-releases` daily at 09:00 UTC.

### Music catalog providers
- Catalog access uses one provider-neutral contract in `lib/providers/` (`contract.js`, `deezer.js`, `youtube.js`, `handlers.js`, `index.js`, `preview-handler.js`, `release-monitoring.js`). Provider-specific URL building and response mapping live only there; the files in `api/` are thin wrappers.
- **Two providers, two jobs.** Deezer is the whole searchable catalog (artists, tracks, albums, EPs) with proxied 30-second previews. YouTube only backs the **Vídeos** filter. There is no Spotify or iTunes adapter.
- Existing catalog endpoints accept `provider` (default `deezer`) and `format=neutral`. Without `format=neutral` the Deezer response shape stays unchanged for already-installed clients; the current client always sends `format=neutral` and receives `{ provider, data }` with provider-scoped ids (`<provider>:<externalId>`).
- `GET /api/search?providers=1` returns provider availability (`[{ id, label, available }]`) without requiring a query. It now reports only `deezer` and `youtube`.
- **Search ranking lives in `src/app/core/catalog/catalog-rank.ts`.** Every result is scored as name-match quality + audience + saved boost: exact 20, prefix 16, every query word 13, contained 11, fuzzy 11 × similarity (threshold 0.82); audience is `log10(1 + fans) + 0.25 · log10(1 + albums)`. An exact match beats a prefix rival unless the prefix has ~10,000× the audience, so "Taylor Swift" wins for "taylor" but a niche exact artist stays first. Ties keep the provider order.
- **Saved artists are always findable.** `SearchComponent.withSavedArtists()` injects any favorite artist whose name matches the query (Deezer's index never returns e.g. `deezer:105607162` for "iban") and gives saved ids a +2 boost. The artist search limit is 25.
- **YouTube is one more search filter, not a separate mode.** The search tab offers Artistas / Canciones / Álbumes / EPs / Vídeos; the first four query Deezer, and `Vídeos` queries YouTube only with a single `/api/search?provider=youtube` call. Selected filters are persisted with the saved search state and YouTube results use the `video` type, so they never dedupe against the same song in the catalog. YouTube is only offered when it is available.
- The filter row (`app-type-filter` + `app-type-chip`) is **icon-only on mobile** (<768px); only the selected chip also shows its label. Each button keeps an `aria-label` with the filter name.
- **A search only calls the endpoints its filter needs.** `Canciones` calls `/search`, `Álbumes`/`EPs` call `/search/album` and `Artistas` calls `/search/artist`, so changing the filter fetches a fresh, type-specific result list instead of trimming the previous one. `Vídeos` is the only filter that touches YouTube (100 quota units per search), so the catalog search never spends YouTube quota.
- **Clicking a video opens a modal with the embedded player**, not a new tab: `VideoPreviewService` creates a CDK overlay with `VideoPreviewModalComponent` (mobile bottom sheet on small screens, centered dialog on desktop) using `youtube-nocookie.com/embed/<id>`. Wishlist videos open the same sheet.
- The sheet **autoplays** through the YouTube IFrame API (`loadYouTubeApi()` in `src/app/shared/utils/youtube-api.ts`): it plays with sound, and if the browser blocks it, retries muted and shows an "Activar sonido" button. If the API cannot load (offline/blocked), it falls back to a plain `autoplay=1` iframe.
- YouTube uses YouTube Data API v3 with `YOUTUBE_API_KEY` and optional `YOUTUBE_REGION` (default `US`). It has no native artist/album/EP entities, so the adapter derives them: **video = track** (link to `youtube.com/watch`, no previews), **channel = artist** (`channels.list` + uploads playlist, top tracks sorted by views), **playlist = album/EP** (`playlists.list` + `playlistItems.list`, `itemCount` decides single/EP/album). Fan uploads, compilations and video collections are filtered out; only VEVO/artist/Topic playlists are trusted. A search costs 100 quota units (default 10,000/day), so YouTube searches tracks only and 100-unit calls are cached for 10 minutes per warm instance.
- **Deezer's artist album list is incomplete for some artists.** `/artist/{id}/albums` can report only a handful of releases (and a matching `nb_album`) while the catalog has many more — SFDK is the reference case: `Inkebrantable` shows up in search but not on the artist page. `deezerAdapter.getArtistAlbums()` therefore merges the endpoint result with a filtered `/search/album?q=artist:"<name>"` search, keeping only albums whose `artist.id` matches and deduping by id. The name travels as `&name=` from `MusicCatalogService.getArtistReleases()` and from `api/check-releases.js` (favorite name), so the artist page, the Releases tab and release monitoring all see the same discography. Without a name the extra call is skipped, and a failing search never breaks the primary list.
- **Search-sourced albums have no `release_date`**, so the merge would lose the chronological order and the Releases tab would drop them. The UI adds `&dates=1`: the adapter then fetches the missing dates from `/album/{id}` (concurrency 6, max 48 per call, cached per warm instance) and sorts newest first. Release monitoring omits `dates` to stay cheap, and `/api/artist-albums` caches the neutral response for one hour. Because Deezer's `nb_album` is just as incomplete, the artist header shows the loaded Albums section count instead of that field.
- Provider capabilities live in `src/app/shared/models/catalog-provider.ts` (`searchTypes`, `previews`, `albumDetail`, `artistDetail`) plus `CATALOG_CAPABILITIES` for the catalog and `CatalogSearchFilter` for the filter row (the four catalog kinds plus `video`). `MusicCatalogService` uses them to skip endpoints a filter does not need, so a filtered search never makes calls that cannot produce its type.
- `catalog-merge.ts` keeps distinct records returned by the same catalog (Deezer has several different artists named "Iban"); it would only collapse cross-catalog copies if another catalog were added.
- `lib/` is not under `api/`, so shared provider code does not count against the 12-endpoint limit. Do not add provider modules under `api/`.
- Provider tests run with `npm run test:api` (`node --test tests/providers/*.test.mjs`).

### Artist merges (split Deezer profiles)
- Deezer sometimes splits one artist into several records. A user can merge them from the artist page; merges are **per user** in `artist-merges/{doc}` (`ownerUid`, `primaryArtistId`, `aliasArtistId`, `primaryName`, `aliasName`). `ArtistMergeService` keeps groups flat (alias → primary, never chains).
- The artist page opens a merge sheet (`artist-merge-picker`) that searches artists **or accepts a Deezer artist URL/id**: the duplicate is often missing from Deezer's own search index. The artist being viewed stays primary.
- The artist page loads the union of the group's top tracks and releases; an alias route redirects to the primary. Favorites and search dedupe by merge root (one card/row per artist), and the heart represents the whole group.
- Releases expands every favorite to its whole merge group before querying; `api/check-releases.js` reads `artist-merges` and uses `expandFavoriteArtists()` so the daily push covers all aliases.
- Demo mode stores merges in `artist-merges-demo-user`. Firestore rules only allow the owner (`ownerUid`) to read/write, and account deletion removes them.

### Artist photo overrides
- The artist picture can be replaced per user from the artist page (pencil button on the cover): upload a photo from the device (resized in the browser to a 600px JPEG data URL) or paste an image URL.
- Overrides live in `artist-images/{uid}_{provider}_{externalId}` (`ownerUid`, `artistId`, `image`, `updatedAt`); demo mode uses `artist-images-demo-user`.
- `ArtistImageService.resolve(artistId, fallback)` is the single read path: artist page, favorite artist cards and search artist rows all prefer the override. Firestore rules are owner-only and account deletion removes the documents.
- Photos are stored in Firestore (not a bucket): `imageFileToDataUrl()` in `src/app/shared/utils/image-file.ts` keeps them around 30-80 kB, well below the 1 MiB document limit.

### Backend integrations
- **Deezer API** — proxied via `/api/search?q=&type=track|album`
- **Firebase** — Auth (Google Sign-In) + Firestore (`wishlist`, `wishlist-shares`, `wishlist-invites`, `favorite-artists`, `artist-merges`, `artist-images`, `push-subscriptions`)

### Auth flow
`AuthService` has two modes:
1. **Real** — Firebase Google Sign-In via popup
2. **Mock/Demo** — activated when `?demo` query param is present. Credentials: `demo` / `1234`

On auth effect, initializes: `WishlistService`, `FavoriteArtistsService`, `WishlistShareService` listeners.

### Push notifications
- **Two transports**: Web Push API with VAPID for the browser PWA, and **FCM HTTP v1** (`@capacitor/push-notifications`) for the native Capacitor app. The native path is selected with `Capacitor.isNativePlatform()`.
- Web uses the custom service worker at `public/service-worker.js` (registered from `main.ts`, web only). The native app updates through Google Play.
- Handles `downloaded`, release and `test` notifications
- `PushNotificationService` manages device registration client-side for both transports
- **Native permission owns the switch**: on native there is no enable/disable control in Perfil. `NativeShellService` calls `PushNotificationService.initializeNative()` after the splash, which creates the `releases` Android channel, asks for `POST_NOTIFICATIONS` once per install (`localStorage['mw-native-notif-asked-v1']`) and registers the device whenever the permission is granted. A `resume` listener re-checks the permission, re-registers on grant and unsubscribes the server registration on revocation. The browser keeps the manual toggle and Web Push flow.
- Android release alerts use data-only FCM messages; `ReleaseMessagingService` renders a cover-art notification with **Add to wishlist** and **View release** actions. Tapping either action opens the album route; the add route queues the release after auth restores. The service extends Capacitor's messaging service so token refresh events keep working.
- FCM notification messages from `api/push.js` target the `releases` channel via `android.notification.channelId`; `AndroidManifest.xml` sets `com.google.firebase.messaging.default_notification_channel_id` as fallback. `api/check-releases.js` sends release data to the native service so Android can add interactive actions.
- Registrations stored per device at Firestore `push-subscriptions/{uid}` (`subscriptions` map for web, `tokens` map for native)
- Server sends web via the `web-push` library (VAPID env vars) and native via the FCM HTTP v1 `messages:send` API
- Avoid `firebase-admin` SDK in endpoints (gRPC/OpenSSL issues on Vercel). Use Firestore REST API directly with Firebase ID token auth or service account OAuth2.
- **`api/push.js`** handles 4 actions: `subscribe`, `unsubscribe`, `test`, `notify-downloaded`. Native sends use `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (service account OAuth2, scope `cloud-platform`) for FCM; web sends use `web-push`. No new endpoint needed.
- `api/check-releases.js` sends release notifications to both transports.
- Release monitoring is provider-aware: each favorite artist's `artistId` is parsed into a provider (bare ids default to Deezer), the matching adapter lists its albums, and a failure for one artist/provider is logged and skipped without aborting the run. The release cache stores external album ids (so legacy Deezer caches keep matching), while push payloads carry the provider-scoped `albumId` (`<provider>:<externalId>`) plus `provider` so notification actions open the correct album route.
- `WishlistService.markDownloaded(entry)` takes full `WishlistEntry` and auto-sends push to the owner if `entry.addedByUid !== currentUser.uid`.

### State management
Angular signals throughout (no NgRx):
- `WishlistService`: `signal<WishlistEntry[]>` synced via Firestore `onSnapshot`
- `AuthService.currentUser` computed from `authState` signal
- Derived signals on WishlistService: `pending()`, `downloaded()`, `trackIds()`, `total()`
- All components use `ChangeDetectionStrategy.OnPush`

### Key architectural facts
- Two wishlist entry sources: own (`addedByUid == uid`) and shared (`sharedWith` array-contains email), merged in `entries()` computed
- `WishlistShareService` handles sharing; share document id format: `{ownerUid}_{normalizedEmail}`
- `WishlistInviteService` handles invites (`wishlist-invites` collection)
- `FavoriteArtistsService` watches `favorite-artists` collection, enriches images from Deezer
- Shared entries have `isOwner: false` flag
- Firestore security rules enforce per-user isolation for `push-subscriptions/{userId}`
- `scripts/set-env.js` generates `src/environments/environment.ts` from env vars during build
- `scripts/generate-version.js` writes `src/version.json` from `package.json` version
- Demo mode stores data in `localStorage` keyed by `wishlist-{uid}`
- `SearchService` caches album, albumTracks, artist, artistTracks in-memory; search state in `sessionStorage`
- `shell.component.ts` has two layouts (desktop ≥768px / mobile) with 3 tabs: releases, search, wishlist (state-driven via `activeTab` signal, saved to localStorage as `defaultTab`)
- Installed PWA `theme-color` is dynamic: `ThemeService` updates the managed `theme-color` meta (`#22201f` dark / `#e5e0d8` light) whenever the effective theme changes; an inline script in `src/index.html` applies the saved/system theme before Angular loads to avoid a flash. `public/manifest.json` is the source of truth for colors (`theme_color`/`background_color` = `#22201f`).
- Android ships as a **Capacitor** app in `android/` (package `com.musicwishlist.app`, `capacitor.config.ts`, `webDir` = `dist/music-wishlist-v2/browser`) that bundles the Angular build locally — no TWA and no Digital Asset Links. `npm run android` runs `scripts/sync-android-version.js` (derives `versionCode` = `major*10000+minor*100+patch` into `android/app/build.gradle`), builds the web app, runs `cap sync android`, then `./gradlew bundleRelease`. Native sign-in and push need `android/app/google-services.json` + an Android OAuth client (see `store/README.md`). Publish via the `google-play-console` skill's `play.mjs`.
- Native Google Sign-In (`@capacitor-firebase/authentication`) requires `plugins.FirebaseAuthentication.providers` to include `google.com` in `capacitor.config.ts` **and** `rgcfaIncludeGoogle = true` in `android/variables.gradle`; missing either makes `signInWithGoogle()` throw a `NullPointerException`. `loggingBehavior: 'production'` is enabled so JS console output is visible in `adb logcat`.

### Key paths
| Path | Purpose |
|------|---------|
| `src/app/core/auth/` | Auth service + guard |
| `src/app/core/api/search.service.ts` | Deezer search + album/artist/track/preview API calls |
| `src/app/core/catalog/` | Provider-neutral catalog layer: provider registry/selection, neutral models, id helpers and `MusicCatalogService` (search, details, tracks, previews, caches) |
| `src/app/shared/models/catalog-provider.ts` | Provider ids/labels, merge order, search filters (catalog kinds + video) and per-provider capabilities |
| `src/app/core/catalog/catalog-merge.ts` | Cross-provider dedupe: identity key, name normalization and fill-missing merge |
| `lib/providers/` | Server provider adapters shared by the existing `/api/*` functions (contract, Deezer, YouTube, handlers, preview handler, release monitoring). Not under `api/`, so it does not count as an endpoint |
| `src/app/core/firebase/wishlist.service.ts` | Firestore CRUD + shared entries merge + push on download |
| `src/app/core/firebase/wishlist-share.service.ts` | Wishlist sharing + batch sharedWith update |
| `src/app/core/firebase/wishlist-invite.service.ts` | Wishlist invite management |
| `src/app/core/firebase/favorite-artists.service.ts` | Favorite artists CRUD with Deezer image enrichment |
| `src/app/core/firebase/artist-merge.service.ts` | Per-user artist merge groups (alias → primary), demo storage and group resolution |
| `src/app/core/firebase/artist-image.service.ts` | Per-user artist photo overrides, demo storage and fallback resolution |
| `src/app/shared/components/artist-merge-picker/artist-merge-picker.component.ts` | Merge sheet: artist search + Deezer URL/id input |
| `src/app/shared/components/artist-photo-editor/artist-photo-editor.component.ts` | Photo sheet: device upload (resized) or image URL + reset |
| `src/app/core/services/push-notification.service.ts` | Device push registration (Web Push + native FCM) |
| `src/app/core/native/native-shell.service.ts` | Native shell: back button, deep links, notification taps, status bar |
| `android/app/src/main/java/com/musicwishlist/app/ReleaseMessagingService.java` | Native rich release notifications, artwork, and wishlist/view actions |
| `src/app/core/native/native-push.ts` | Injectable wrapper over `@capacitor/push-notifications` |
| `src/app/core/api/api-base-url.interceptor.ts` | Prefixes `/api/*` with `apiBaseUrl` on native |
| `src/app/core/services/preview.service.ts` | HTML5 audio track preview player |
| `src/app/core/services/modal.service.ts` | CDK Overlay-based modal |
| `src/app/core/services/navigation.service.ts` | URL history tracking for back navigation |
| `src/app/core/services/update.service.ts` | SW update notification |
| `src/app/core/services/artist-cache.service.ts` | In-memory artist data cache |
| `src/app/core/config/config.service.ts` | Demo mode detection |
| `src/app/core/theme/theme.service.ts` | Light/dark/system theme |
| `src/app/core/i18n/language.service.ts` | es/en translations |
| `src/app/core/version/version.service.ts` | Fetch `/version.json` |
| `android/` | Capacitor Android project (Gradle, `app/build.gradle`, `google-services.json`) |
| `capacitor.config.ts` | Capacitor app id, name, `webDir`, splash/status-bar plugins |
| `resources/` | Android native branding source images consumed by `@capacitor/assets` (icon + splash) |
| `scripts/generate-native-branding.mjs` | `npm run android:assets`: render `public/icon.svg` → `resources/` + regenerate Android icon/splash; `ICON_MARK`/`FOREGROUND_MARK` set the launcher mark scale shared by all icon variants |
| `scripts/sync-android-version.js` | Derive Android version into `android/app/build.gradle` |
| `scripts/android-release.js` | `npm run android`: version sync + web build + `cap sync` + signed AAB + mapping |
| `store/README.md` | Google Play release flow and prerequisites |
| `store/listing/` | Play Store listing copy (`listing.<lang>.json`) + images, applied via the skill's `play.mjs listing` |
| `scripts/capture-store-screenshots.mjs` | `npm run store:screenshots`: Playwright captures of every app section |
| `scripts/generate-feature-graphic.mjs` | `npm run store:feature`: renders the feature graphic from `public/icon.svg` + the header wordmark |
| `src/main.ts` | Bootstrap + service-worker registration (web only) |
| `src/app/shell/shell.component.ts` | Root layout (desktop/mobile with 3 tabs) |
| `src/app/features/login/` | Login page |
| `src/app/features/wishlist/` | Wishlist tab |
| `src/app/features/search/` | Search tab |
| `src/app/features/releases/` | Releases tab |
| `src/app/features/artist/` | Artist detail page (`/artist/:id`) |
| `src/app/features/album/` | Album detail page (`/album/:id`) |
| `src/app/features/profile/` | Profile page with subsections: account, settings, shared, stats |
| `src/app/shared/models/wishlist-entry.model.ts` | `WishlistEntry` interface |
| `src/app/shared/models/wishlist-share.model.ts` | `WishlistShare` interface |
| `src/app/shared/models/wishlist-invite.model.ts` | `WishlistInvite` interface |
| `src/app/shared/models/track.model.ts` | `Track`, `TrackType` interfaces |
| `src/app/shared/models/release-item.model.ts` | `ReleaseItem`, `AlbumTrack` interfaces |
| `src/app/shared/models/favorite.artist.model.ts` | `FavoriteArtist` interface |
| `src/app/shared/models/deezer.ts` | Deezer API response types |

## Routes
| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginComponent` | none |
| `/` | `ShellComponent` | `authGuard` |
| `/artist/:id` | `ArtistComponent` | authGuard (inherited) |
| `/album/:id` | `AlbumComponent` | authGuard (inherited) |
| `/profile` | `ProfileComponent` | none |
| `**` | redirect to `/` | — |

## Conventions
- All SVGs via `icon.component.ts` + `icon-registry.ts` (34 icons) — never inline SVG
- Tailwind CSS only for styles, design tokens in `src/styles.css` `@theme` block
- I18n: `LanguageService.t()` returns a `computed()` with translations
- `ToastService` for success/error toasts
- Long-lived subscriptions use `takeUntilDestroyed()`
- **Vercel free plan constraint**: max 12 serverless API endpoints. Add logic to existing endpoints rather than creating new files.
- Custom animations in `src/styles.css` (16 keyframe animations) + `src/app/shared/animations/animations.ts`
- `swiper` library for horizontal scroll/carousel (`HorizontalScrollComponent`)
- `FloatingPlayerComponent` shown when `PreviewService` has an active preview
- Service worker caches same-origin GET requests (cache-first), posts `NEW_VERSION_AVAILABLE` on activate
- All feature components use lazy loading via routes
