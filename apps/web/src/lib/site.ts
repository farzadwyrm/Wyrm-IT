/** Site-wide copy and navigation. Marketing text changes start here. */
export const SITE = {
  name: "Wyrm IT",
  tagline: "Practical AI for small and medium businesses",
  description:
    "Wyrm IT helps small and medium businesses adopt AI safely: a readiness check of your IT foundations, then AI assistants that answer calls, find answers in your documents and automate busywork.",
  bookingUrl: "#contact",
} as const;

export interface Offer {
  name: string;
  summary: string;
  price: string;
}

/** The offer ladder from docs/business/OFFER.md. Keep both in sync. */
export const OFFERS: readonly Offer[] = [
  {
    name: "AI-Readiness Scan",
    summary: "Answer a short questionnaire and get an instant score plus your top fixes.",
    price: "Free",
  },
  {
    name: "IT & AI Assessment",
    summary: "A structured review of your identity, devices, data, security and AI use, with a prioritised roadmap.",
    price: "Fixed fee",
  },
  {
    name: "AI Solutions",
    summary: "AI receptionist, ask-your-documents assistant and workflow automation, built for your business.",
    price: "Per project",
  },
  {
    name: "Managed AI",
    summary: "We run, monitor and improve your AI assistants every month so you never have to.",
    price: "Monthly",
  },
];

export interface Demo {
  slug: string;
  name: string;
  summary: string;
  status: "coming-soon" | "live";
}

export const DEMOS: readonly Demo[] = [
  {
    slug: "readiness-scan",
    name: "AI-Readiness Scan",
    summary: "See how ready your IT foundations are for AI, scored across seven areas.",
    status: "coming-soon",
  },
  {
    slug: "ai-receptionist",
    name: "AI Receptionist",
    summary: "Talk to a receptionist for a fictional clinic that answers questions and books visits.",
    status: "coming-soon",
  },
  {
    slug: "ask-your-docs",
    name: "Ask Your Documents",
    summary: "Ask questions about a sample company handbook and get answers with sources.",
    status: "coming-soon",
  },
];
