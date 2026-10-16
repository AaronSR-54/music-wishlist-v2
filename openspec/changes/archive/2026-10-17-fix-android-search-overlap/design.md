# Design

## Context

The search tab (`SearchComponent`) is a `flex flex-col justify-between h-full overflow-hidden`
column. Its state area lives in a `flex flex-col gap-4 flex-1 min-h-0` section, and the
favorite-artists carousel is a sibling below it, shown only when there is no query and the user has
favorites.

The scroll behavior that constrains the state area is the `.scroll-fade` rule (`flex: 1;
overflow-y: auto;`), defined inside `SearchComponent`'s own component styles. `SearchEmptyStateComponent`
also puts `class="scroll-fade"` on its wrapper `<div>`, but Angular's emulated view encapsulation
compiles `SearchComponent`'s rule to `.scroll-fade[_ngcontent-search]`, which does not match the
empty-state's element `[_ngcontent-empty]`. The wrapper therefore gets no sizing or overflow, and
the state section's content is not constrained.

On Android the usable height is reduced (system bars / smaller screen), so the unconstrained idle
state grows past its `flex-1 min-h-0` section and paints over the favorite-artists carousel below it.
On taller web viewports there is enough room, so the defect is not noticed. See proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Make the search tab's state area self-constrain and scroll in every state (idle, empty, results).
- Fix the empty/idle state specifically, since it is the only state whose wrapper relies on the
  missing scoped style.
- Keep the existing visual layout (position, spacing, animations) on desktop and tall mobile
  viewports.

**Non-Goals:**
- Redesigning the search screen or vertically centering the idle state.
- Changing search behavior, API calls, filters or the favorites data flow.
- Introducing a new global scroll utility or refactoring other components' `.scroll-fade` rules.

## Decisions

**1. Make `SearchEmptyStateComponent` self-contained instead of extending the parent's styles.**
Give the component its own `:host { display: flex; flex: 1; min-height: 0; }` and apply the scroll
container styles to its internal wrapper (the same `flex: 1; overflow-y: auto` behavior as
`.scroll-fade`), rather than trying to reach into it from `SearchComponent`.
- Rationale: matches the project convention where each feature/component defines its own
  `.scroll-fade` (album, artist, wishlist and search all do), and keeps the component correct in any
  parent.
- Alternative considered: promote `.scroll-fade` to a global rule in `src/styles.css`. Rejected
  because four components already ship scoped copies; a global rule would duplicate/compete with them
  and risk leaking scroll behavior into unrelated markup.

**2. Keep the search tab's flex structure; only make the empty state participate.**
The section is already `flex-1 min-h-0`, and the results/loading states already constrain and scroll
correctly via `.scroll-fade` in `SearchComponent`'s template. No structural change is needed.
- Alternative considered: restructure the search tab with CSS grid or absolute positioning.
  Rejected as invasive and unnecessary once the empty state is constrained.

**3. Reuse the existing `.has-preview .scroll-fade` bottom-padding override.**
Because the empty state's wrapper keeps the `scroll-fade` class, the existing global rule that adds
bottom padding when the floating preview player is visible continues to apply.

## Risks / Trade-offs

- [Host `flex: 1` stretches the empty state to fill the section, which could shift the short idle
  state vertically] → The empty state is top-aligned today, so filling the box does not move its
  content; verify no visible change on desktop.
- [`search-empty-state` might be reused elsewhere] → It is currently used only by `SearchComponent`
  (idle and empty variants); the change is local to that usage.
- [Overflow is also affected by the shell's `mobile-content`/safe-area sizing] → Keep the shell
  untouched; the fix is scoped to the components that own the state area. If overlap persists after
  the fix, revisit the shell height chain as a separate change.

## Migration Plan

Ships in the normal web/Android release. No data or API migration. Roll back by reverting the
component style change; no stored state is affected.

## Open Questions

- Vertical centering of the idle state is a possible follow-up but is out of scope here.
