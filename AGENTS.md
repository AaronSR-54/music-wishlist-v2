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

**MANDATORY: every change MUST bump the version in `package.json`.** No change is considered complete until `package.json` `version` has been incremented — this includes changes that did not originate from a commit or that are not yet committed. Never leave the version untouched after editing code.

The version follows the SemVer pattern `major-minor-micro` (`X.Y.Z`), bumped according to the kind of change:

| Change type | Number to bump | Example |
|-------------|---------------|---------|
| `fix:`, `perf:`, `refactor:`, `chore:`, docs, styles | 3rd (micro / patch) | `0.10.0` → `0.10.1` |
| `feat:`, `update:` | 2nd (minor) | `0.10.0` → `0.11.0` |
| `BREAKING CHANGE`, `feat!:`, breaking refactors | 1st (major) | `0.10.0` → `1.0.0` |

Rules:
- Bump the highest-order number that applies and **reset every lesser number to `0`** (minor bump `0.10.0` → `0.11.0`; major bump `0.10.0` → `1.0.0`).
- When several changes are grouped, use the most significant change type for the bump.
- If you are about to commit and the version was not bumped during the change, bump it as part of that commit.
- `scripts/generate-version.js` writes `src/version.json` from `package.json` on `prebuild`/`prestart`, so never edit `src/version.json` manually.

## Architecture
Angular 20 SPA deployed on Vercel (free plan: max 12 serverless endpoints). Uses `@angular/build:application` builder (standalone bootstrap, no NgModules).

### API endpoints (currently 12 — at the Vercel free-plan limit)
`api/search.js`, `api/search/album.js`, `api/search/artist.js`, `api/push.js`, `api/check-releases.js`, `api/album.js`, `api/album-tracks.js`, `api/track.js`, `api/preview.js`, `api/artist.js`, `api/artist-info.js`, `api/artist-albums.js`.

**Do not create new api/*.js files** unless strictly necessary — reuse existing endpoints via actions/parameters. Currently at 12/12 limit.

Vercel cron runs `api/check-releases` daily at 09:00 UTC.

### Backend integrations
- **Deezer API** — proxied via `/api/search?q=&type=track|album`
- **Firebase** — Auth (Google Sign-In) + Firestore (`wishlist`, `wishlist-shares`, `wishlist-invites`, `favorite-artists`, `push-subscriptions`)

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
- Registrations stored per device at Firestore `push-subscriptions/{uid}` (`subscriptions` map for web, `tokens` map for native)
- Server sends web via the `web-push` library (VAPID env vars) and native via the FCM HTTP v1 `messages:send` API
- Avoid `firebase-admin` SDK in endpoints (gRPC/OpenSSL issues on Vercel). Use Firestore REST API directly with Firebase ID token auth or service account OAuth2.
- **`api/push.js`** handles 4 actions: `subscribe`, `unsubscribe`, `test`, `notify-downloaded`. Native sends use `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (service account OAuth2, scope `cloud-platform`) for FCM; web sends use `web-push`. No new endpoint needed.
- `api/check-releases.js` sends release notifications to both transports.
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
| `src/app/core/firebase/wishlist.service.ts` | Firestore CRUD + shared entries merge + push on download |
| `src/app/core/firebase/wishlist-share.service.ts` | Wishlist sharing + batch sharedWith update |
| `src/app/core/firebase/wishlist-invite.service.ts` | Wishlist invite management |
| `src/app/core/firebase/favorite-artists.service.ts` | Favorite artists CRUD with Deezer image enrichment |
| `src/app/core/services/push-notification.service.ts` | Device push registration (Web Push + native FCM) |
| `src/app/core/native/native-shell.service.ts` | Native shell: back button, deep links, notification taps, status bar |
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
| `scripts/generate-native-branding.mjs` | `npm run android:assets`: render `public/icon.svg` → `resources/` + regenerate Android icon/splash |
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
- All SVGs via `icon.component.ts` + `icon-registry.ts` (26 icons) — never inline SVG
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
