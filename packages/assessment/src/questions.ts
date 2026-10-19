import type { Question } from "./types";

/**
 * Self-serve AI-Readiness & IT Health Scan — starter question bank.
 * Written in Wyrm IT's own words for small and medium businesses.
 * Phase 2 of the roadmap expands this to ~25 questions (see docs/business/ROADMAP.md).
 */
export const QUESTIONS: readonly Question[] = [
  {
    id: "id.mfa-everywhere",
    pillar: "identity",
    phase: 1,
    weight: 3,
    prompt: "Is two-step sign-in (MFA) required on email and every system reachable from the internet?",
    whyItMatters:
      "Most small-business breaches start with a stolen password. MFA blocks the large majority of them.",
  },
  {
    id: "id.separate-admin",
    pillar: "identity",
    phase: 1,
    weight: 2,
    prompt: "Do administrators use a separate account for admin work, apart from their daily account?",
    whyItMatters:
      "If a daily account is phished, a separate admin account keeps the attacker away from the keys to everything.",
  },
  {
    id: "id.offboarding",
    pillar: "identity",
    phase: 2,
    weight: 2,
    prompt: "When someone leaves, is all of their access removed on their last day?",
    whyItMatters:
      "Former staff with working logins are a common, avoidable source of data leaks.",
  },
  {
    id: "dev.managed-laptops",
    pillar: "devices",
    phase: 2,
    weight: 2,
    prompt: "Are company laptops centrally managed, encrypted and updated automatically?",
    whyItMatters:
      "A lost unencrypted laptop is a reportable data breach; unmanaged updates leave known holes open.",
  },
  {
    id: "net.segmented",
    pillar: "network",
    phase: 2,
    weight: 1,
    prompt: "Are guest Wi-Fi, office devices and servers kept on separate networks?",
    whyItMatters:
      "Separation stops one infected device or visitor from reaching everything else.",
  },
  {
    id: "data.tested-backups",
    pillar: "data",
    phase: 1,
    weight: 3,
    prompt: "Are backups taken automatically, kept off-site, and has a restore been tested in the last 6 months?",
    whyItMatters:
      "Untested backups often fail exactly when you need them, for example after ransomware.",
  },
  {
    id: "data.know-where-data-lives",
    pillar: "data",
    phase: 3,
    weight: 1,
    prompt: "Do you know where your customer and business data is stored (which apps and drives)?",
    whyItMatters:
      "You cannot protect, back up or safely give AI access to data you have not located.",
  },
  {
    id: "app.saas-inventory",
    pillar: "applications",
    phase: 3,
    weight: 1,
    prompt: "Is there an up-to-date list of the software subscriptions the company pays for, with an owner for each?",
    whyItMatters:
      "Unknown subscriptions waste money and keep data in places nobody is watching.",
  },
  {
    id: "app.ai-usage-policy",
    pillar: "applications",
    phase: 4,
    weight: 2,
    prompt: "Do staff have clear guidance on which AI tools are approved and what data must never be pasted into them?",
    whyItMatters:
      "Without guidance, confidential customer data ends up in public AI tools.",
  },
  {
    id: "app.ai-human-review",
    pillar: "applications",
    phase: 4,
    weight: 2,
    prompt: "When AI produces something customers will see or rely on, does a person review it first?",
    whyItMatters:
      "AI can be confidently wrong. Human review protects your reputation while trust is built.",
  },
  {
    id: "vis.alerts-actioned",
    pillar: "visibility",
    phase: 2,
    weight: 2,
    prompt: "If a key system goes down or a suspicious login happens, does someone get alerted and act on it?",
    whyItMatters:
      "Problems found in minutes are cheap; problems found by customers are expensive.",
  },
  {
    id: "fnd.critical-systems",
    pillar: "foundation",
    phase: 1,
    weight: 2,
    prompt: "Have you written down the 3 systems the business cannot run without for a single day?",
    whyItMatters:
      "Knowing what is critical tells you where to spend the first euro of IT and AI budget.",
  },
];
