# Local outreach plan: from zero to the first paying client

**Goal (6 weeks):** 50 local businesses contacted personally → 10 conversations → 3 free scans
or demos walked through together → 1 paid pilot.
These are targets to steer by, not predictions. Adjust after the first 20 contacts.

**Time:** about 1 hour a day, plus LinkedIn posts (see `LINKEDIN.md`).

---

## Step 0: before contacting anyone (one evening)

Every message sends people to the website, so these must work first:

1. **Booking link:** create a free account at https://cal.com with one event: "Intro call, 30 min".
   In Vercel → Environment Variables, add `NEXT_PUBLIC_BOOKING_URL` = your Cal.com link
   (Production), then redeploy. The Contact page's "Book a call" then opens your calendar.
2. **Business email:** create an address like `hello@` (a free Zoho Mail or a Google Workspace
   trial once you have a domain). Add it as `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel, then redeploy.
3. **Read every page of the site** and fix anything that isn't true for you.
4. **Decide whether prospects see the AI or the basic receptionist.** The basic one is fine for
   the first messages. Before a demo call, add the Anthropic key ($5) so they see the real AI.
5. **Make your tracker** from `leads-template.csv` (Google Sheets or Excel). Keep it outside this
   repository: it will contain real names and contact details.

---

## Step 1: pick two sectors and one area

Start narrow; it makes every message more specific. Good first sectors (from `IDEAL_CLIENT.md`):

| Sector | Why it fits | What to look for |
|---|---|---|
| Dental and medical clinics, physiotherapists | Phone rings during appointments; bookings are the business | Phone-only booking, no online calendar, reviews mentioning "hard to reach" |
| Accountants and small law firms | Repeated client questions, lots of documents | Generic contact form, no FAQ, many staff |
| Trades (plumbers, electricians, HVAC) | Calls missed while on site; quotes chased by hand | "Call us" as the only option, slow replies in reviews |

Choose **two** sectors and your **city plus nearby towns**.

## Step 2: build a list of 50 (about 2 hours)

1. Google Maps: search "[sector] [town]". Open each result.
2. Keep businesses with **5 to 50 staff** (team page, number of practitioners, or vans).
3. For each, note in your tracker:
   - name, website, phone, generic email (info@ / contact@), owner or manager name if public
   - **one specific observation** about them (this is what gets replies):
     - "booking is phone-only"
     - "reviews mention it's hard to get through"
     - "website has no online booking or FAQ"
     - "open late on Wednesdays but the phone line closes at 5"
4. Find the owner or practice manager on LinkedIn if possible.

## Step 3: contact 5 businesses every weekday (2 weeks = 50)

Mix channels; local businesses often answer the phone or the door faster than email.

| Day | Action |
|---|---|
| Day 0 | First message (LinkedIn connection note, or email to the generic address) |
| Day 3 | Follow-up 1 (short, adds one useful thing) |
| Day 8 | Follow-up 2 (last one, easy yes or no) |
| Any time | For walk-in-friendly businesses (clinics, shops): visit in a quiet hour with a one-page flyer |

Stop immediately if someone asks you to. Never more than 3 touches without a reply.

---

## Templates (edit every message: the observation line must be real and specific)

### LinkedIn connection note (under 300 characters)

> Hi [Name], I'm an engineer in [city] helping small practices use AI safely. I noticed [observation]. I built a free 4-minute scan that shows where AI could help a business like [Business]. Happy to connect.

### LinkedIn message after they accept

> Thanks for connecting, [Name].
>
> Quick context: I run Wyrm AI. We help small businesses check their IT basics and then add one practical AI assistant, often an AI receptionist that answers routine calls and books appointments, always with the team in control.
>
> I noticed [observation]. If that costs [Business] calls or time, I'd be glad to show you a 5-minute demo built for a (fictional) clinic: [receptionist link]
>
> No pitch deck. If it's not useful, just say so.

### Email (to the generic address or the manager)

**Subject:** [Business]: calls during appointments

> Hello [Name / Business] team,
>
> I'm [Your name], an engineer based in [city]. I noticed [observation].
>
> I help small businesses with exactly this: an AI receptionist that answers routine questions, checks the real calendar and books appointments, and only confirms after the caller says yes. Your team keeps control of anything unusual.
>
> You can try a demo for a fictional clinic here (2 minutes): [receptionist link]
> Or take our free 4-minute IT and AI readiness scan: [scan link]
>
> Would a 20-minute call next week be useful? If not, reply "no thanks" and I won't write again.
>
> [Your name]
> Wyrm AI · [website] · [phone]

### Follow-up 1 (day 3)

> Hi [Name], a quick follow-up. One thing I see often: [one useful, specific tip, e.g. "the busiest missed-call window for clinics is the first hour after opening"; only use tips you have seen to be true]. If it's worth 20 minutes, here's my calendar: [booking link].

### Follow-up 2 (day 8, last)

> Hi [Name], last note from me. If AI for [calls / documents / quotes] isn't a priority right now, no problem at all. If it becomes one, the free scan is here anytime: [scan link]. Wishing you a good week.

### Phone opener (30 seconds)

> "Hi, my name is [name], I'm a local engineer. I'm not selling anything today. I'm talking to [sector] businesses in [town] about how they handle calls when everyone's busy. Could I ask you two quick questions?"
>
> 1. "When the phone rings during appointments, what usually happens?"
> 2. "Roughly how many calls a day go unanswered?"
>
> If there's a problem: "I've built something for exactly that. Could I send you a two-minute demo, or show you in person?"

### Walk-in flyer (one page)

- Headline: **"Never miss a booking call again."**
- Three lines: answers routine calls and messages 24/7 · checks your real calendar and books ·
  books only after the caller confirms, and hands anything unusual to your team.
- "Free 4-minute AI-readiness scan" with a QR code to the scan page.
- Your name, phone, email.

---

## Step 4: the first call (20–30 minutes)

Goal: understand one painful, repeated task. Do not pitch for the first 15 minutes.

1. **Their week (10 min):** use the questions in `IDEAL_CLIENT.md`:
   - Which 3 systems could the business not run without for a day?
   - What repetitive task wastes the most hours each week?
   - How many calls or emails go unanswered?
   - Has anything gone wrong with IT or security in the past year?
   - Is anyone already using AI tools? Which ones, for what?
2. **Show, don't tell (5 min):** walk through the receptionist demo or their scan results.
3. **Offer one next step (5 min):** pick the one that fits:
   - **Founding-client pilot** (see below), or
   - **IT & AI Assessment** if their basics look risky (passwords, backups, former staff accounts).
4. **Close:** agree a date for the next conversation before you hang up. Send a short summary
   email the same day.

### Founding-client pilot offer (first 3 clients only)

- One AI assistant (usually the receptionist) set up for their business, 4-week pilot.
- One measurable goal agreed up front, e.g. "answer every call between 9 and 10 am".
- Reduced founding price in exchange for: honest feedback, permission to write a short case study,
  and a testimonial if they're happy.
- Price: decide before the call and say it plainly. Starting points are in `OFFER.md`.
- Before signing anything real, see the "Legal" row in `ROADMAP.md` (contract, data processing).

### Common objections

| They say | You answer (honestly) |
|---|---|
| "AI makes mistakes." | "Yes. That's why our booking rules are in code, not left to the AI, and anything unusual goes to your team. Try to break the demo." |
| "We're too small." | "That's who this is for: businesses without an IT department. We start with one task." |
| "How much?" | Give the pilot price straight away. Vague prices lose trust. |
| "Our patients prefer a human." | "They still get one for anything that matters. The AI handles the routine questions so your team has time for them." |
| "We need to think about it." | "Of course. What would you need to see to decide?" Then follow up on that exact thing. |

---

## Step 5: track and review every Friday (15 minutes)

| Number | This week | Total |
|---|---|---|
| New businesses contacted | | |
| Replies (any) | | |
| Calls booked | | |
| Scans or demos done together | | |
| Pilots agreed | | |
| LinkedIn: posts / comments / profile views | | |

Each Friday, write 3 lines in your tracker: what worked, what didn't, what you change next week.
After 20 contacts with no replies, change the message, not the effort: make the observation line
more specific, or switch sectors.

---

## Rules we keep

- **Every message is personal and true.** No mass mailing, no invented numbers or clients.
- **Easy opt-out.** Include "reply no thanks and I won't write again" and respect it immediately.
- **Business contacts only.** Use business addresses and public business information.
- **No real customer data in demos.** Prospects try the fictional clinic, not their own data.
- **Real lead data stays out of this repository** (the tracker lives in your own sheet).
- Email marketing rules differ by country; before sending at volume, check the local rules for
  cold business email (part of the "Legal" step in `ROADMAP.md`).
