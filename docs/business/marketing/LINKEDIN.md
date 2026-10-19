# LinkedIn: profile setup and first six posts

Goal for the first two weeks: people in your network know what Wyrm IT does, and a few of them
try the free scan or the receptionist demo. Three posts a week (Tue, Wed, Thu mornings work for
most B2B audiences; test your own).

## Rules we follow (from 2026 research, treat as starting points and check your own stats)

- **Link in the first comment, not in the post.** Body links reduce reach. Post, then add the link
  as your own first comment straight away.
- **First two lines decide everything.** They must make someone stop scrolling.
- **0 to 3 hashtags.** More does not help.
- **Reply to every comment within the first hour.** Early engagement drives reach.
- **Honest only.** No invented numbers, clients or testimonials. When you have a real result, it
  becomes your best post.
- Short paragraphs, one idea per post, end with a question or one clear action.

## Before the first post (one evening)

1. **Headline:** `Engineer building practical AI for small businesses | Founder, Wyrm IT`
2. **About:** 3 short paragraphs: who you help (small and medium businesses), the problem (they
   want AI but their IT basics are not ready, and they have no one to ask), what you do (check
   the basics, then build AI assistants that save hours). End with: "Try the free AI-Readiness Scan:
   wyrm-it.vercel.app/scan".
3. **Featured section:** add the scan and the receptionist demo links.
4. **Create a Wyrm IT company page** (logo = the wyrm mark from the website).
5. **Banner:** one line on a dark background: "Practical AI, on IT foundations you can trust."
6. **Fix the website's booking first** (see `OUTREACH.md`, step 0): every post sends people there.

## Links for first comments (the `utm` part shows in analytics where visitors came from)

- Scan: `https://wyrm-it.vercel.app/scan?utm_source=linkedin&utm_campaign=launch`
- Receptionist: `https://wyrm-it.vercel.app/receptionist?utm_source=linkedin&utm_campaign=launch`
- Article: `https://wyrm-it.vercel.app/blog/five-questions-before-adding-ai?utm_source=linkedin`

---

## Post 1 (Week 1, Tuesday): the launch

> For years I've been the engineer companies call when IT breaks.
>
> Lately the question has changed. It's no longer "can you fix the server?" It's "should we be using AI, and where do we even start?"
>
> Big companies have teams for that. Small businesses usually have one busy person who "knows computers".
>
> So I've started Wyrm IT.
>
> The idea is simple:
> 1. First, check the basics: who can log in to what, where your data lives, whether backups would really work.
> 2. Then pick ONE task where AI saves real hours, and build it with clear limits on what the AI may do.
>
> No hype, no 40-slide strategy decks. Engineers who build it and run it.
>
> To start, I built a free 4-minute AI-Readiness Scan. It scores your IT foundations across seven areas and tells you what to fix first. Link in the first comment.
>
> If you run a small business: what's the one task you'd hand to an assistant tomorrow?

First comment: scan link.

## Post 2 (Week 1, Thursday): the uncomfortable truth

> Most small-business AI projects fail before the AI part even starts.
>
> Not because the AI is bad. Because it gets connected to:
> • shared passwords nobody has changed in years
> • accounts of people who left months ago
> • files scattered across five laptops and three inboxes
> • backups nobody has ever tried to restore
>
> An AI assistant inherits all of that.
>
> Before you add AI, answer five questions:
> 1. Which task costs us the most time each week?
> 2. Where does the data for that task actually live?
> 3. Who can log in to those systems, and is two-step sign-in on?
> 4. What must a person always check before it reaches a customer?
> 5. How will we know it worked?
>
> I wrote these up in more detail (link in comments).
>
> Which of the five would be hardest for your business to answer?

First comment: article link.

## Post 3 (Week 2, Tuesday): try to break my receptionist

> I built an AI receptionist for a dental clinic that doesn't exist.
>
> And I'd like you to try to break it.
>
> Ask it for an appointment on a Sunday. Ask for yesterday. Change your mind halfway through. Ask where to park in the middle of booking.
>
> The one thing it should never do: book without your clear "yes". That rule isn't a polite request in a prompt. It's enforced in code, so the AI can't talk its way past it.
>
> That's the difference between a chatbot demo and something a business can trust with its calendar.
>
> Link in the first comment. Tell me what it got wrong: every mistake becomes a test so it can't happen again.

First comment: receptionist link.
Note: until the Anthropic key is added, the demo runs in its basic (rule-based) mode and says so.
Consider adding the key before this post.

## Post 4 (Week 2, Wednesday): the missed-call problem

> Think about the last time you called a small business and nobody picked up.
>
> Did you call back? Or did you call the next one on the list?
>
> For a clinic, a plumber, an accountant, the phone rings exactly when everyone is busy doing the actual work. That's not a staff problem. It's a timing problem.
>
> An AI receptionist doesn't replace the team. It answers the routine calls (opening hours, prices, booking a slot) and hands anything unusual to a person.
>
> The businesses I talk to don't want "AI". They want to stop losing the customers who didn't leave a voicemail.
>
> If you run a small business: how do you handle calls when everyone's busy?

No link (pure discussion post, usually the best reach).

## Post 5 (Week 2, Thursday): document carousel

Make a 7-slide PDF in Canva (dark background, ember accent, one idea per slide) and upload it
as a document post.

- Slide 1: "7 IT basics to check before you connect AI to your business"
- Slide 2: **Two-step sign-in everywhere.** Most small-business breaches start with one stolen password.
- Slide 3: **Separate admin accounts.** A phished daily account shouldn't hold the keys to everything.
- Slide 4: **Offboarding on day one.** Former staff with working logins are an avoidable leak.
- Slide 5: **Backups you have actually restored.** Untested backups fail exactly when you need them.
- Slide 6: **Know where your data lives.** You can't safely give AI access to data you haven't found.
- Slide 7: **A simple AI rule for staff.** Which tools are approved, and what never gets pasted in.
- Final slide: "Score yourself in 4 minutes: free scan, link in comments. Wyrm IT"

Post text:

> AI will happily read every file it's given access to.
>
> That's exactly why these seven basics matter more now than they did two years ago.
>
> Swipe through. How many can your business tick?

First comment: scan link.

## Post 6 (Week 3): behind the build

> A question I get as an engineer: "How do you stop an AI from doing something stupid with my calendar?"
>
> Short answer: you don't let it make the decisions that matter.
>
> In the receptionist I built:
> • The AI talks. Code checks every slot against the real calendar.
> • The AI can only *propose* a booking. You see a confirmation card.
> • Booking only works on your *next* message, and only if that message is a clear yes. "Yes, but make it 11" doesn't count.
>
> The AI is great at understanding people. The rules belong in code.
>
> That split is the whole job when you build AI for a real business.

First comment: receptionist link.

---

## After each post (10 minutes)

- Reply to every comment; ask a follow-up question.
- Send a short thank-you DM to anyone who tried the scan or demo and said so.
- Note in the tracker: impressions, comments, profile visits, scan visits (see `OUTREACH.md`).
