# MusicWishlist.

![Login](public/screenshots/screenshot-login.png)

A music wishlist app built with Angular 20 that lets you search for tracks and albums via Deezer, save them to a personal wishlist, and track their download status.

## Tech Stack

- **Frontend**: Angular 20 with signals, standalone components, OnPush change detection
- **Styling**: Tailwind CSS with custom design tokens
- **Backend**: Firebase (Auth + Firestore) + Vercel serverless API functions
- **Search**: Deezer API (proxied via Vercel serverless functions)
- **Deployment**: Vercel

## Features

- **Search**: Search tracks and albums via Deezer API
- **Wishlist**: Add/remove items, mark as downloaded, filter by status
- **Releases**: View new releases from favorite artists
- **Profile**: Account settings, language, theme (light/dark/system)
- **Share**: Share wishlists with other users via invite links
- **Demo Mode**: Test the UI without Firebase auth using `?demo` query param
- **i18n**: Spanish and English translations

## Demo Mode

Visit `http://localhost:4200/?demo` to try the app without a Google account:

- Username: `demo`
- Password: `1234`

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

Open `http://localhost:4200/`

### Build

```bash
npm run build
```

Output: `dist/music-wishlist-v2/browser/`

## Firebase Configuration

To run the app with real authentication, you need to set up Firebase:

1. Create a project at [firebase.google.com](https://firebase.google.com)
2. Enable **Authentication** → Google sign-in provider
3. Enable **Firestore** (create database in test mode or with rules)
4. Copy `src/environments/environment.ts` to `src/environments/environment.local.ts`
5. Add your Firebase config keys:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID'
  }
};
```

6. Update Firebase Console → Authentication → **Authorized domains**:
   - `localhost` (for development)
   - `your-project.vercel.app` (for production)

### Tests

```bash
npm test
```

Run a single test file:

```bash
ng test --include='**/wishlist.service.spec.ts'
```

## Project Structure

```
src/app/
├── core/
│   ├── api/          # Deezer search integration
│   ├── auth/         # Firebase Auth + mock auth
│   ├── config/      # App configuration (demo mode)
│   ├── firebase/    # Firestore services (wishlist, favorites, invites)
│   ├── guards/      # Route guards
│   ├── i18n/        # Translations (ES/EN)
│   └── theme/       # Theme switching
├── features/
│   ├── login/       # Authentication
│   ├── profile/     # User settings
│   ├── releases/    # New releases from favorites
│   ├── search/      # Deezer search
│   └── wishlist/    # Personal wishlist
├── layout/          # Header, tab bar
└── shared/
    ├── components/  # Reusable UI components
    ├── icons/       # SVG icon system
    └── models/      # TypeScript interfaces
```

## Deployment

The app deploys automatically to Vercel via the included `vercel.json` configuration. API endpoints are deployed as serverless functions.

### PWA theming

The installed app's `theme-color` (status bar / browser chrome) follows the active theme. `ThemeService` writes the effective light/dark background color into the managed `theme-color` meta on every change, and a small inline script in `src/index.html` applies the saved/system theme before Angular loads to avoid a flash. `src/index.html`, `public/meta-tags.html` and `public/manifest.json` all use `#22201f` (dark) as the default; the manifest is the source of truth for colors.

## Android app (Google Play)

The app also ships as a **Capacitor** Android app that bundles the Angular build locally and runs it in a WebView (no TWA, no URL bar). Build a signed App Bundle with `npm run android` and publish it via the Google Play Developer API — see [`store/README.md`](store/README.md) for the full release flow, Firebase setup (native sign-in + FCM) and the closed-testing requirement.

**Native integrations**: Google Sign-In uses `@capacitor-firebase/authentication` and push uses `@capacitor/push-notifications` (FCM); both need `android/app/google-services.json`. The shell handles the Android back button, deep links and notification taps, and the status bar follows the active theme at runtime.

## License

MIT
