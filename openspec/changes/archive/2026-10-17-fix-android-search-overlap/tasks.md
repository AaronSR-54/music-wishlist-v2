# Tasks

## 1. Constrain the search empty state

- [x] 1.1 Add self-contained sizing and scroll styles to `SearchEmptyStateComponent` (`:host { display: flex; flex: 1; min-height: 0; }` plus a wrapper scroll container with `flex: 1; overflow-y: auto` and a hidden scrollbar), so the idle/empty state no longer overflows its section; verify `npm run build` succeeds and the emitted component CSS contains the host and wrapper rules
- [x] 1.2 Confirm the `SearchComponent` state section still uses `flex-1 min-h-0` and that the loading/results states remain constrained by the existing `.scroll-fade` rule; verify the diff touches only the empty-state component (and any shared style intentionally changed)

## 2. Verify the search tab layout

- [x] 2.1 Run `npm start` and check the search tab at a short mobile viewport (e.g. DevTools 360x640 or an Android device): with favorites and no query the idle "start typing" state is readable and does not overlap the favorites carousel; the no-results state renders correctly; a long result list scrolls internally; entering a query shows the type filters without overlap
- [x] 2.2 Verify the desktop layout (≥1024px) is visually unchanged: input, filters, state area and favorites section stay in their existing positions

## 3. Release hygiene

- [x] 3.1 Bump `version` in `package.json` by a patch (0.22.4 → 0.22.5) and verify `scripts/generate-version.js` rewrites `src/version.json` on the next `prestart`/`prebuild`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result updates `openspec/specs/search-experience/spec.md`.
