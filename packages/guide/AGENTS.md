# packages/guide

"Your IT, explained": a plain-language guide to the IT systems of a business (19 areas, each
tagged with a Zero Trust pillar and a priority phase 1-4). Pure TypeScript data and text
matching: no I/O, no AI calls, no React. Shared by the `/guide` pages and the Ask AI.

- `src/areas.ts`: the content. Written in our own words; never copy text from third-party
  handbooks or name their authors or clients.
- `src/ground.ts`: `pickArea` (which area a question is about), `compactArea` (small, fixed
  context for the AI), `instantAnswer` (zero-token answers), `fallbackAnswer` (no AI available).

Rules (tested in `src/*.test.ts`): every area has all fields and at least 3 warning signs,
quick wins and questions; slugs and related links are valid; compact context stays small.
