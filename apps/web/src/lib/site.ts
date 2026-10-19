/** Site-wide copy, navigation and contact settings. Marketing text changes start here. */

const env = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : null);

function siteUrl(): string {
  const explicit = env(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;
  // Set by Vercel at build time, e.g. "wyrm-it.vercel.app" (or the custom domain once added).
  const vercel = env(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export const SITE = {
  name: "Wyrm IT",
  tagline: "Practical AI for small and medium businesses",
  description:
    "Wyrm IT helps small and medium businesses adopt AI safely: a readiness check of your IT foundations, then AI assistants that answer calls, find answers in your documents and automate busywork.",
  /** Public address: explicit setting first, then Vercel's production domain, then local dev. */
  url: siteUrl(),
  /** Cal.com / Calendly link. When unset, the site shows "booking opens soon" instead of a dead link. */
  bookingUrl: env(process.env.NEXT_PUBLIC_BOOKING_URL),
  /** Public business email. When unset, no email address is shown. */
  contactEmail: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
} as const;

export const NAV = [
  { href: "/services", label: "Services" },
  { href: "/scan", label: "Free scan" },
  { href: "/#demos", label: "Demos" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
] as const;

export interface Offer {
  slug: string;
  name: string;
  summary: string;
  price: string;
  forWho: string;
  deliverables: readonly string[];
}

/** The offer ladder from docs/business/OFFER.md. Keep both in sync. */
export const OFFERS: readonly Offer[] = [
  {
    slug: "readiness-scan",
    name: "AI-Readiness Scan",
    summary: "Answer a short questionnaire and get an instant score plus your top fixes.",
    price: "Free",
    forWho: "Any business curious about AI that wants a quick, honest starting point.",
    deliverables: [
      "Score across seven areas of your IT foundations",
      "Your top fixes, ordered by risk",
      "A written summary you can share with your team",
    ],
  },
  {
    slug: "assessment",
    name: "IT & AI Assessment",
    summary:
      "A structured review of your identity, devices, data, security and AI use, with a prioritised roadmap.",
    price: "Fixed fee",
    forWho: "Teams that want AI but are not sure their accounts, data and backups are ready.",
    deliverables: [
      "Interviews with the people who run your systems day to day",
      "Findings marked in place, partial or gap, with priority",
      "A roadmap: what to fix first, and which AI use cases pay off",
    ],
  },
  {
    slug: "solutions",
    name: "AI Solutions",
    summary:
      "AI receptionist, ask-your-documents assistant and workflow automation, built for your business.",
    price: "Per project",
    forWho:
      "Businesses with a clear time sink: missed calls, repeated questions, manual data entry.",
    deliverables: [
      "A working assistant connected to your calendar, documents or tools",
      "Guardrails: what the AI may and may not do, with human review where it matters",
      "Training for your team and a handover document",
    ],
  },
  {
    slug: "managed",
    name: "Managed AI",
    summary: "We run, monitor and improve your AI assistants every month so you never have to.",
    price: "Monthly",
    forWho: "Clients who want results without hiring an AI or IT specialist.",
    deliverables: [
      "Hosting, monitoring and model updates",
      "Monthly review of conversations and accuracy",
      "Priority support and small improvements included",
    ],
  },
];

export interface Demo {
  slug: string;
  name: string;
  summary: string;
  status: "coming-soon" | "live";
  /** Where the demo lives once it is live. */
  href?: string;
}

export const DEMOS: readonly Demo[] = [
  {
    slug: "readiness-scan",
    name: "AI-Readiness Scan",
    summary: "See how ready your IT foundations are for AI, scored across seven areas.",
    status: "live",
    href: "/scan",
  },
  {
    slug: "ai-receptionist",
    name: "AI Receptionist",
    summary:
      "Talk to a receptionist for a fictional clinic that answers questions and books visits.",
    status: "live",
    href: "/receptionist",
  },
  {
    slug: "ask-your-docs",
    name: "Ask Your Documents",
    summary: "Ask questions about a sample company handbook and get answers with sources.",
    status: "coming-soon",
  },
];

export interface UseCase {
  sector: string;
  problem: string;
  solution: string;
}

export const USE_CASES: readonly UseCase[] = [
  {
    sector: "Clinics and practices",
    problem: "Phones ring during appointments and patients hang up.",
    solution:
      "An AI receptionist answers every call, books visits and hands urgent cases to staff.",
  },
  {
    sector: "Law and accounting firms",
    problem: "Staff spend hours searching old files and templates.",
    solution: "An assistant that answers questions from your own documents and shows its sources.",
  },
  {
    sector: "Trades and home services",
    problem: "Quotes and follow-ups slip while the team is on site.",
    solution: "Automations that capture enquiries, draft quotes and chase replies.",
  },
];

export const PRINCIPLES = [
  {
    title: "Foundations first",
    body: "We check accounts, backups and access before connecting AI to your data, so AI does not create new risk.",
  },
  {
    title: "Engineers, not slideware",
    body: "The people who advise you are the people who build and run the system.",
  },
  {
    title: "People stay in control",
    body: "AI drafts and suggests; your team approves anything that matters to customers.",
  },
  {
    title: "Plain language, fixed prices",
    body: "You know what you get and what it costs before work starts.",
  },
] as const;

/** Every static page, used by the sitemap and the smoke tests. Add new pages here. */
export const STATIC_ROUTES = [
  "/",
  "/services",
  "/scan",
  "/receptionist",
  "/about",
  "/contact",
  "/blog",
] as const;
