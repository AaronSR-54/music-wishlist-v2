# Tasks

## 1. Artist photo
- [x] 1.1 Add `ArtistImageService` with `imageFor`, `resolve`, `setImage`, `clearImage`, demo storage and listener lifecycle
- [x] 1.2 Initialize/stop the listener from `AuthService` (real and demo) and delete the collection on account deletion
- [x] 1.3 Add owner-only Firestore rules for `artist-images`
- [x] 1.4 Add the pencil button on the artist cover and the photo sheet with device upload, image URL and reset
- [x] 1.5 Resize uploads to a 600px JPEG data URL before saving
- [x] 1.6 Use the override on the artist page, favorite artist cards and search artist rows

## 2. Video autoplay
- [x] 2.1 Load the YouTube IFrame API once and create the player in `VideoPreviewModalComponent`
- [x] 2.2 Autoplay with sound, retry muted when the browser blocks it and show "Activar sonido"
- [x] 2.3 Fall back to a plain `autoplay=1` iframe when the API cannot load
- [x] 2.4 Destroy the player when the sheet closes

## 3. Verification
- [x] 3.1 Unit tests for the photo overrides (store, fallback, reset)
- [x] 3.2 Angular suite, API suite and production build pass
- [x] 3.3 Verify in demo: upload, persistence after reload, reset
- [x] 3.4 Verify a video starts playing (media requests, no pause state) and the sheet layout on mobile/desktop
- [ ] 3.5 Verify the real Firestore path with a signed-in account after deploying
