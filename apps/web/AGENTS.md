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
- Voice-call tests use Chromium's fake microphone and the scripted fakes in `e2e/fake-speech.ts`;
  never real speech services. The call visual must never be the only carrier of state.
- Tests never call paid AI APIs: Playwright starts the server with `ANTHROPIC_API_KEY` and `GROQ_API_KEY` empty,
  and unit tests pass a fake client. Keep it that way.
- Agent pages (`/agents`) and the workflow analyser (`/analyse`) read content and scoring only
  from `@wyrm/agents`; never score or write agent copy in components. The analyser must work
  with no AI key (text-based step drafting) and keep answers in the browser.
- Pages must work at 375px width with no horizontal scroll.
- Every new page goes in `STATIC_ROUTES` (`src/lib/site.ts`) so the sitemap and the
  Playwright smoke tests in `e2e/` cover it automatically.
- Verify with `pnpm verify` from the repo root before declaring work done.
