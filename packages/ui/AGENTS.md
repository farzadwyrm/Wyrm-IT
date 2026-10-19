# packages/ui

Brand tokens and shared presentational React components.

- `src/theme.css`: the only place brand colours and fonts are defined (Tailwind v4 `@theme`),
  including dark-mode values.
- Components are presentational: no data fetching, no business logic, no `"use client"` unless
  the component needs browser interactivity.
- Every component must be keyboard accessible and show a visible focus ring.
