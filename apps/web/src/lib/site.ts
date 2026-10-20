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
  name: "Wyrm AI",
  tagline: "AI agents that run your workflows",
  description:
    "Wyrm AI designs, deploys and runs AI agents for small and medium businesses: voice, inbox, sales, support and back-office agents with human checks and full audit trails.",
  /** Public address: explicit setting first, then Vercel's production domain, then local dev. */
  url: siteUrl(),
  /** Cal.com / Calendly link. When unset, the site shows "booking opens soon" instead of a dead link. */
  bookingUrl: env(process.env.NEXT_PUBLIC_BOOKING_URL),
  /** Public business email. When unset, no email address is shown. */
  contactEmail: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
} as const;

export const NAV = [
  { href: "/agents", label: "Agents" },
  { href: "/planner", label: "Workflow planner" },
  { href: "/receptionist", label: "Live demo" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
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
    slug: "workflow-sprint",
    name: "Agent Discovery Sprint",
    summary:
      "Two weeks to map your workflows, find where agents pay off and design the first one in detail.",
    price: "Fixed fee",
    forWho: "Teams that know AI could help but not where to start.",
    deliverables: [
      "Workshops with the people who do the work today",
      "Your workflows mapped, with time spent and agent fit for each",
      "A detailed design of the first agent: steps, systems, guardrails, success measures",
    ],
  },
  {
    slug: "build-deploy",
    name: "Agent Build & Deploy",
    summary:
      "We build the agent, connect it to your systems, test it on real cases and put it live.",
    price: "Per agent",
    forWho: "Businesses with a clear, repetitive workflow: calls, email, leads, invoices, support.",
    deliverables: [
      "A working agent connected to your phone, inbox, CRM or accounting",
      "Guardrails and human approval steps where money, customers or safety are involved",
      "Evaluation on real examples before go-live, and team training",
    ],
  },
  {
    slug: "managed-agents",
    name: "Managed Agents",
    summary: "We run, monitor and improve your agents every month, so they keep getting better.",
    price: "Monthly",
    forWho: "Clients who want agents working every day without hiring an AI team.",
    deliverables: [
      "Hosting, monitoring, alerts and model updates",
      "Monthly review of conversations, accuracy and time saved",
      "New skills and workflows added as your business changes",
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
    slug: "voice-agent",
    name: "Voice agent",
    summary:
      "Call or chat with a receptionist agent for a fictional clinic. It answers, books and confirms.",
    status: "live",
    href: "/receptionist",
  },
  {
    slug: "workflow-planner",
    name: "Workflow planner",
    summary: "Describe a task your team does by hand. The AI designs the agent workflow for it.",
    status: "live",
    href: "/planner",
  },
  {
    slug: "knowledge-agent",
    name: "Knowledge agent",
    summary: "Ask questions about a sample company's documents and get answers with sources.",
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
    solution: "A voice agent answers every call, books visits and hands urgent cases to staff.",
  },
  {
    sector: "Professional services",
    problem: "The shared inbox and document searches eat hours every day.",
    solution:
      "An inbox agent drafts replies; a knowledge agent answers from your files with sources.",
  },
  {
    sector: "Trades, retail and e-commerce",
    problem: "Leads, orders and invoices pile up while the team is busy.",
    solution: "Sales and back-office agents qualify leads, chase replies and enter the data.",
  },
];

export const PRINCIPLES = [
  {
    title: "Agents with guardrails",
    body: "Every agent has written limits. Money, customers and anything risky go through a human check.",
  },
  {
    title: "Measured, not promised",
    body: "We test every agent on your real cases before go-live, then report what it actually does each month.",
  },
  {
    title: "Engineers, not slideware",
    body: "The people who design your agents are the people who build, deploy and run them.",
  },
  {
    title: "Your data stays yours",
    body: "Least-privilege access, full audit logs, and no training on your data without your say.",
  },
] as const;

/** Every static page, used by the sitemap and the smoke tests. Add new pages here. */
export const STATIC_ROUTES = [
  "/",
  "/agents",
  "/planner",
  "/receptionist",
  "/services",
  "/about",
  "/contact",
  "/blog",
] as const;
