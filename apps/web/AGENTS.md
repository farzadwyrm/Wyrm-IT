# apps/web

Public marketing site and AI demos (Next.js App Router, Tailwind v4).

## Next.js version rule

This repo uses Next.js 16, which has breaking changes compared with older versions (APIs,
conventions, file structure). Before writing Next.js code, read the relevant guide in
`apps/web/node_modules/next/dist/docs/` and follow its deprecation notices. Do not rely on memory.

## Rules

- Copy and navigation live in `src/lib/site.ts`; keep `OFFERS` in sync with `docs/business/OFFER.md`.
- Brand colours come from `@wyrm/ui/theme.css` tokens (`text-ink`, `bg-paper`, `text-ember`…).
  Never hard-code hex colours in components.
- Server Components by default. Add `"use client"` only for interactive parts.
- Demo routes must use `@wyrm/ai`'s demo guard and fictional data only.
- Pages must work at 375px width with no horizontal scroll.
- Every new page goes in `STATIC_ROUTES` (`src/lib/site.ts`) so the sitemap and the
  Playwright smoke tests in `e2e/` cover it automatically.
- Verify with `pnpm verify` from the repo root before declaring work done.
