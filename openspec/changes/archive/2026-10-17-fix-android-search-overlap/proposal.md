# Proposal

## Why

On Android (and any viewport where the search tab has little vertical room), the favorite-artists
carousel overlaps the idle empty state ("Empieza a escribir" / "Start typing") when the search tab
is opened. The right-hand side of the section above can't be read, so the first thing a user sees on
the search tab looks broken.

## What Changes

- Constrain the search tab's state area (idle empty state, empty results, results list) so it stays
  inside its allotted space and scrolls instead of overflowing into the favorite-artists section.
- Make the empty/idle state component self-contained (its own scroll container and flex sizing)
  instead of relying on a `.scroll-fade` class that is scoped to the search component and therefore
  never reaches it.
- Ensure the favorite-artists section and the state area never paint over each other on short
  viewports (mobile Android), while leaving the desktop layout unchanged.

## Capabilities

### New Capabilities
- `search-experience`: how the search tab lays out its input, filters, idle/empty/results states and
  the favorite-artists section so each region stays within the available viewport.

### Modified Capabilities
<!-- None: no existing spec covers the search tab UI. -->

## Impact

- `src/app/shared/components/search-empty-state/search-empty-state.component.ts` (layout/scroll
  container for the idle and empty states).
- `src/app/features/search/search.component.ts` (search tab flex layout and state placement).
- Possibly `src/styles.css` if a shared scroll utility is introduced.
- No API, Firestore, auth, push or dependency changes. No new Vercel endpoints.
- `package.json` version bump (patch) per the project versioning rule.
