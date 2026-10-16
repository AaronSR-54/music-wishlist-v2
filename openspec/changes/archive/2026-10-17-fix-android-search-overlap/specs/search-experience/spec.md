# Spec Delta

## Purpose

Defines how the search tab arranges its input, type filters, state area (idle, empty and results)
and the favorite-artists section so each region stays within the available viewport and never
paints over another, on both mobile (including Android) and desktop.

## ADDED Requirements

### Requirement: Search tab regions never overlap
The search tab SHALL lay out its state area and the favorite-artists section so that neither region
paints over the other, at any supported viewport height.

#### Scenario: Idle search on a short viewport
- **WHEN** the user opens the search tab on a small-height viewport (for example Android) with saved favorite artists and no query
- **THEN** the idle "start typing" state is fully readable and does not overlap the favorite-artists carousel

#### Scenario: Desktop layout is unchanged
- **WHEN** the search tab is shown on a desktop-sized viewport
- **THEN** the input, filters, state area and favorite-artists section render in the same regions as before without overlap

### Requirement: Search state area stays within its allotted space
The search tab's state area SHALL be constrained to the space left after the header, search input,
filters and favorite-artists section, and SHALL scroll within that space when its content is taller
than it.

#### Scenario: Idle or empty state taller than the available space
- **WHEN** the idle or empty state content is taller than the remaining space above the favorite-artists section
- **THEN** the state area scrolls internally and the favorite-artists section stays visible below it

#### Scenario: Long results list
- **WHEN** a search returns more results than fit in the state area
- **THEN** the results scroll within the state area without pushing or overlapping the favorite-artists section

#### Scenario: Type filters shown with a query
- **WHEN** the user enters a query so the type filters appear
- **THEN** the remaining state area shrinks to fit the filters and still scrolls internally instead of overlapping other regions
