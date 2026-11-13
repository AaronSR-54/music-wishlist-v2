# Proposal

## Why

Two small gaps in the artist experience:

- Deezer's artist picture is sometimes wrong, outdated or a placeholder, and the user has no way to fix it.
- Opening a video in the preview sheet loads the player but does not start playback, so the user has to press play on every video.

## What Changes

- Add a **per-user artist photo**: a pencil button on the artist cover opens a sheet where the user can upload a photo from the device (resized in the browser) or paste an image URL, and reset it back to the Deezer picture.
- Store overrides in a new `artist-images` Firestore collection (`ownerUid`, `artistId`, `image`, `updatedAt`); demo mode uses `artist-images-demo-user`.
- Resolve the override wherever the artist photo is shown: artist page, favorite artist cards and search artist rows.
- Play videos automatically through the YouTube IFrame API: try playback with sound, fall back to muted autoplay with an "Activar sonido" button, and use a plain `autoplay=1` iframe when the API cannot load.

## Impact

- New `ArtistImageService`, `ArtistPhotoEditorComponent`, `youtube-api.ts` loader and `image-file.ts` helper.
- `VideoPreviewModalComponent` now owns the player lifecycle instead of rendering a static iframe.
- Firestore rules and account deletion cover the new collection.
- No new API endpoints (still 12).
