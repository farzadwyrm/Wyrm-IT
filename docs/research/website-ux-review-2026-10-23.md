# Website UX review: simplify for business owners (2026-10-23)

Review only, no source changes. Based on the live site (wyrm-it.vercel.app, desktop 800px and mobile 375px) and `apps/web/src`. Word counts are approximate, taken from the rendered main content.

## 1. Summary

1. Code-style decoration is everywhere: `// EYEBROWS` on every section (59 `font-mono`/Eyebrow uses), `agent.01` numbering, `agent.run("inbox-agent")`, `6 steps · 4 integrations`, `agents / inbox-agent` breadcrumbs. To a dentist this reads as "built for programmers".
2. Too many words. The home page has about 750 words in 8 sections, and three of them (Anatomy, Deployment, Principles) explain *how we work*, not *what you get*.
3. Content is repeated. Principles appear on Home and About word for word, the same CTA band closes every page (including /analyse, where it links back to itself), and the workflow is explained on Home, Services and About.
4. Naming is inconsistent: "Workflow analysis" (nav), "Analyse a workflow" (buttons), "Workflow assessment" (page). It takes "about seven minutes" on Home and "About 15 minutes" on /analyse.
5. The hierarchy is weak. The hero has 3 competing actions plus a search box, cards have 4 text layers, and agent pages lead with long summaries and jargon ("Classify and extract", "KPIs", "capped by risk", "least-privilege").

## 2. Principles

- **One idea per section, one action per section.** Each section has a heading, at most one short sentence, and then the content.
- **Outcomes, not mechanics.** Say "Never miss a call", not "Trigger → AI agent → System".
- **Plain English.** No code syntax, no numbering that carries no meaning, no "integrations", "workflow", "KPIs" or "guardrails" in headings ("rules" and "checks" are fine).
- **Say it once.** Each fact lives on one page, and other pages link to it.
- **Same card everywhere:** title, one line, one link.
- Keep the dark theme, the ember/signal colours and the display font. Use mono only inside the diagram, if at all.

## 3. Page-by-page

### / (home): `app/page.tsx`, `lib/site.ts`
- **Remove:** the hero eyebrow "ai agents · designed, deployed, managed"; the `agent.run("…")` / "live" title bar on the hero diagram (replace it with a plain caption "Example: email answered for you"); the "Anatomy of an agent" section; the "Principles" section (it already lives on /about); the `before`/`after` mono labels.
- **Shorten:**
  - Hero paragraph → "We set up AI assistants that answer your phone, reply to emails and chase invoices, so your team can get on with the real work. You stay in control."
  - Hero buttons: keep **two**, "See what we can automate" (→ /agents) as primary and "Try the live demo" (→ /receptionist) as secondary. Move the task search box into the "Try it" section (it keeps its label "Name a task to analyse", which the e2e test uses).
  - Agents section title → "What our agents do"; link "all 12 agents →" → "See all agents".
  - Use cases title → "Where it helps most". Each card: sector + one line, e.g. "Clinics: every call answered and booked, even mid-appointment."
  - Deployment → title "How it works", 3 steps without the "01/02" mono: "We talk", "We build and test", "We run it for you", each with one line.
- **Restructure:** Hero → Agents (6 cards) → Try it (2 live demos; drop the "Coming soon" card) → Where it helps → How it works → CTA. That is 6 sections instead of 8, with a target of about 350 words.

### /agents: `app/agents/page.tsx`, `components/agent-card.tsx`
- **Remove:** the `// CUSTOMERS` etc. eyebrows above each group (the h2 already says the same thing); the `index` prop and the `agent.NN` label; the steps/integrations footer.
- **Shorten:**
  - Title → "Pick a job to hand over"; intro → "Each agent does one job, works with the tools you already use, and asks a person before anything important."
  - Category h2 becomes the plain category name ("Customers", "Sales", …) with `category.intro` as a muted one-liner below it.
- **Card (agent-card.tsx):** drop the `agent.NN` label and the steps/integrations footer. Show name, tagline (one-line outcome) and "See how it works →". Replace the mono "live demo" chip with a small sans badge "Try it live" placed after the name.
- Keep the category pill nav, since it is useful on mobile.

### /agents/[slug]: `app/agents/[slug]/page.tsx`, `components/workflow-diagram.tsx`
- **Remove:** the mono breadcrumb `agents / inbox-agent`. Replace it with a sans link "← All agents", keeping `aria-label="Breadcrumb"` and showing `agent.name`, not the slug. Also remove the `// capabilities` / `// workflow` eyebrows and the mono "What we measure" chips. Move measures into the CTA conversation instead; they are internal metrics.
- **Shorten:** show `agent.tagline` under the h1, not `summary`. Rename "What it does" (keep it). Workflow heading → "How it works, step by step". Rename "Guardrails" → "Always checked by a person" and "Connects to" → "Works with".
- **Restructure:** Hero (name, tagline, 1 to 2 buttons) → What it does (4 bullets) → How it works (diagram + Works with + checks) → CTA. Replace the "Your process is different?" line with nothing, because the CTA band covers it. Diagram step text: show the step title only, with the detail line in muted small text (it is already there). Step kind labels stay, since the e2e test needs "Human check".

### /analyse: `app/analyse/page.tsx`, `components/analyser/*`
- **Shorten:** title → "See what you could automate"; intro → "Answer a few questions about one task. You get a clear report: what to automate, what it saves, and how to start. About 15 minutes." Fix the Home demo copy to say 15 minutes, or measure the real time and use that.
- **Remove:** the eyebrow "workflow assessment" and the `CtaBand` on this page, or pass a prop that hides the self-link "Analyse a workflow now".
- Do not rename the report headings ("Executive summary", "Opportunity matrix", …): `e2e/analyse.spec.ts` asserts all 10. Field labels "Process name", "Cases" and "Hands-on time" are also asserted.

### /receptionist: `app/receptionist/page.tsx`
- **Shorten:** intro → "Chat with or call the receptionist of Harbor Lane Dental, a pretend clinic. Try booking an appointment. Nothing is really booked."
- **Remove:** the "About this demo" technical paragraph, or fold it to one line: "Our own checks confirm every time and booking, so it never double-books." Cut "Things to try" from 6 to 3 items (call, change your mind, ask about parking).
- Keep "What it always does" (it builds trust) but cut it to 3 bullets. Keep the portal link.

### /services: `app/services/page.tsx`, `lib/site.ts` OFFERS
- **Shorten:** title → "Three ways to work with us"; intro → "Start small. Add more only when the first agent pays for itself." Rename offers to plain words: "1. Find the right task", "2. Build your agent", "3. We run it for you" (keep the old names as small subtitles if sales needs them). Each offer: 1-line summary, "For:" line, 2 bullets max.
- **Remove:** the "Least-privilege"-style jargon in bullets and the "steps, systems, guardrails, success measures" list.

### /about: `app/about/page.tsx`
- Cut from 4 paragraphs to 2: the founder paragraph and the "We start with one task…" paragraph. Keep the wyrm name story as one line. Keep "What we believe" here only (removed from Home). Change "Least-privilege access, full audit logs" → "We only access what the agent needs, and every action is logged."

### /contact and /blog
- Contact is already the clearest page. Just remove the eyebrow. Blog: remove the eyebrow, and the intro → "Short, practical notes on using AI in a small business." Keep the `complementary "Booking"` aside and the "Open booking calendar" link name (both are tested).

## 4. Global component changes

- **Eyebrow** (`components/sections.tsx`): remove the `// ` prefix and the mono uppercase tracking. Either delete Eyebrow use entirely (preferred, since every h1/h2 is clear without it) or make it a sans `text-sm font-medium text-signal`. Make `PageHeader.eyebrow` and `SectionTitle.eyebrow` optional, and stop passing them.
- **CtaBand** (`sections.tsx`): eyebrow "next step" off. Title → "Not sure where to start?"; body → "Book a free 30-minute call. We'll look at your week and tell you honestly what's worth automating." Buttons: "Book a free call" plus an optional secondary "Try the live demo". Add a `secondary?: false` prop for /analyse and /contact.
- **Cards:** one style for agent, demo, use-case and offer cards: rounded-2xl, border-line, title (display, semibold), one muted line, one ember text link. No mono anywhere in cards.
- **Header** (`site-header.tsx`, `lib/site.ts` NAV): reduce to 4 items: "Agents", "Live demo", "How we work" (/services), "About". Move "Workflow analysis" to the home and /agents pages (the route is unchanged). Keep "Sign in" and "Book a call" with the same link names. The mobile menu keeps "Client sign in". The smoke test clicks "Services", so either keep the label "Services" or update `smoke.spec.ts:37`.
- **Footer** (`site-footer.tsx`): fine. Add "Workflow analysis" under Explore if it is removed from the header.
- **Typography:** remove `font-mono` from all marketing copy (diagram kind labels may stay small caps sans). Use body text-base for card lines instead of text-sm on mobile, and cap paragraphs at about 25 words.
- **Buttons:** at most 2 per section, with one primary per screen. The hero search becomes part of the "Try it" section.

## 5. Prioritized implementation

**P1: biggest clarity win, low risk, no test changes**
1. `agent-card.tsx`: remove `agent.NN`, the steps/integrations footer and the mono chip. Add "See how it works →". Drop the `index` prop in `page.tsx` and `agents/page.tsx`.
2. `sections.tsx` Eyebrow: remove `//`, the mono and the uppercase (or stop rendering it). This is one change for the whole site.
3. Home: remove the "Anatomy" and "Principles" sections and the `agent.run(...)` bar. Shorten the hero copy.
4. `/agents` page title and intro copy. Plain category headings.
5. Agent detail: sans breadcrumb "← All agents", tagline instead of summary, remove the eyebrows and the measures chips.
6. Make time and naming consistent ("15 minutes"; use "Workflow analysis" everywhere).

**P2: medium effort**
7. `CtaBand` copy plus a prop to hide the self-link on /analyse and /contact.
8. Receptionist page: trim the intro, "Things to try" and "About this demo".
9. Services: plain offer names, 2 bullets each. About: 2 paragraphs, plain-English principle.
10. Home: move the task search into "Try it", 2 hero buttons, "How it works" in 3 steps, drop the coming-soon demo card.

**P3: needs test updates or owner sign-off**
11. Nav reduced to 4 items. Update `smoke.spec.ts:37` if "Services" is renamed.
12. /analyse report/field wording simplification. Update the heading list in `analyse.spec.ts:63-75` and the field names at `:33-57`.

**Must keep for the tests:** one h1 per page; `nav[aria-label="Main"]`; header link "Sign in" and menu/footer "Client sign in"; textbox "Name a task to analyse" (it may move, but must stay on `/` and submit to `/analyse?q=`); a link to every `/agents/<slug>` on /agents; the figure caption "Workflow: …" and the step text "Human check"; region "Receptionist demo" and its buttons; aside "Booking". Keep `sr-only` labels and the `aria-labelledby` ids on sections when titles change.
