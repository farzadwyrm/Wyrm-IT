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
  /** The client portal (sign-in for clients and Wyrm staff). */
  portalUrl:
    env(process.env.NEXT_PUBLIC_PORTAL_URL)?.replace(/\/+$/, "") ??
    "https://wyrm-portal.vercel.app",
  /** Public business email. When unset, no email address is shown. */
  contactEmail: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
} as const;

export const NAV = [
  { href: "/agents", label: "Agents" },
  { href: "/analyse", label: "Workflow analysis" },
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
    name: "Find the right task",
    summary: "Two weeks to find where an agent saves you the most time, and plan the first one.",
    price: "Fixed fee",
    forWho: "You know AI could help but not where to start.",
    deliverables: [
      "We sit with your team and see how the work is done today",
      "A clear plan for your first agent, with the time it saves",
    ],
  },
  {
    slug: "build-deploy",
    name: "Build your agent",
    summary:
      "We build the agent, connect it to your tools, test it on real cases and switch it on.",
    price: "Per agent",
    forWho: "You have a repetitive task: calls, emails, leads, invoices or support.",
    deliverables: [
      "Works with your phone, inbox, calendar or accounting",
      "A person approves anything involving money or customers",
    ],
  },
  {
    slug: "managed-agents",
    name: "We run it for you",
    summary: "We keep your agents running and improve them every month.",
    price: "Monthly",
    forWho: "You want agents working every day without hiring an AI team.",
    deliverables: [
      "We watch every run and fix what's off",
      "A short monthly report: what it did and the time it saved",
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
    slug: "workflow-analysis",
    name: "Workflow analysis",
    summary:
      "Answer questions about one task and see which steps an agent should take over. About 15 minutes.",
    status: "live",
    href: "/analyse",
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
    body: "We only access what the agent needs, every action is logged, and we never train on your data.",
  },
] as const;

/** Every static page, used by the sitemap and the smoke tests. Add new pages here. */
export const STATIC_ROUTES = [
  "/",
  "/agents",
  "/analyse",
  "/receptionist",
  "/services",
  "/about",
  "/contact",
  "/blog",
] as const;
