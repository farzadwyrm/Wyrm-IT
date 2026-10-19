import type { Question } from "./types";

/**
 * Self-serve AI-Readiness & IT Health Scan question bank (24 questions, 7 areas).
 * Written in Wyrm IT's own words for small and medium business owners.
 * Keep it short: every extra question lowers the number of people who finish the scan.
 */
export const QUESTIONS: readonly Question[] = [
  {
    id: "id.mfa-everywhere",
    pillar: "identity",
    phase: 1,
    weight: 3,
    prompt:
      "Is two-step sign-in (MFA) required on email and every system reachable from the internet?",
    whyItMatters:
      "Most small-business breaches start with a stolen password. MFA blocks the large majority of them.",
  },
  {
    id: "id.separate-admin",
    pillar: "identity",
    phase: 1,
    weight: 2,
    prompt:
      "Do administrators use a separate account for admin work, apart from their daily account?",
    whyItMatters:
      "If a daily account is phished, a separate admin account keeps the attacker away from the keys to everything.",
  },
  {
    id: "id.offboarding",
    pillar: "identity",
    phase: 2,
    weight: 2,
    prompt: "When someone leaves, is all of their access removed on their last day?",
    whyItMatters: "Former staff with working logins are a common, avoidable source of data leaks.",
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
    whyItMatters: "Separation stops one infected device or visitor from reaching everything else.",
  },
  {
    id: "data.tested-backups",
    pillar: "data",
    phase: 1,
    weight: 3,
    prompt:
      "Are backups taken automatically, kept off-site, and has a restore been tested in the last 6 months?",
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
    prompt:
      "Is there an up-to-date list of the software subscriptions the company pays for, with an owner for each?",
    whyItMatters: "Unknown subscriptions waste money and keep data in places nobody is watching.",
  },
  {
    id: "app.ai-usage-policy",
    pillar: "applications",
    phase: 4,
    weight: 2,
    prompt:
      "Do staff have clear guidance on which AI tools are approved and what data must never be pasted into them?",
    whyItMatters: "Without guidance, confidential customer data ends up in public AI tools.",
  },
  {
    id: "app.ai-human-review",
    pillar: "applications",
    phase: 4,
    weight: 2,
    prompt:
      "When AI produces something customers will see or rely on, does a person review it first?",
    whyItMatters:
      "AI can be confidently wrong. Human review protects your reputation while trust is built.",
  },
  {
    id: "vis.alerts-actioned",
    pillar: "visibility",
    phase: 2,
    weight: 2,
    prompt:
      "If a key system goes down or a suspicious login happens, does someone get alerted and act on it?",
    whyItMatters: "Problems found in minutes are cheap; problems found by customers are expensive.",
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
  {
    id: "fnd.it-owner",
    pillar: "foundation",
    phase: 2,
    weight: 2,
    prompt: "Is one named person responsible for IT decisions, even if only part-time?",
    whyItMatters:
      "When everyone owns IT, nobody does: renewals lapse, accounts pile up and problems wait.",
  },
  {
    id: "fnd.supplier-list",
    pillar: "foundation",
    phase: 3,
    weight: 1,
    prompt:
      "Do you have a list of your IT suppliers, what each one does, and who to call when something breaks?",
    whyItMatters:
      "During an outage, finding the right phone number should take seconds, not hours.",
  },
  {
    id: "id.password-manager",
    pillar: "identity",
    phase: 2,
    weight: 2,
    prompt:
      "Are shared passwords kept in a password manager, rather than in spreadsheets, notes or chat?",
    whyItMatters:
      "Passwords in documents and chats get copied, forwarded and forgotten, and are easy to steal.",
  },
  {
    id: "dev.security-software",
    pillar: "devices",
    phase: 2,
    weight: 2,
    prompt:
      "Do all work computers run security protection (antivirus or EDR) that someone actually monitors?",
    whyItMatters: "Protection that nobody watches only tells you about an attack after the damage.",
  },
  {
    id: "dev.phones",
    pillar: "devices",
    phase: 3,
    weight: 1,
    prompt:
      "Are phones used for work email protected with a passcode, and can they be wiped if lost?",
    whyItMatters: "A lost phone with open email is a direct way into customer conversations.",
  },
  {
    id: "net.router",
    pillar: "network",
    phase: 2,
    weight: 2,
    prompt:
      "Is your office router or firewall kept up to date, with its admin password changed from the default?",
    whyItMatters: "Default passwords and old firmware are the first things automated attacks try.",
  },
  {
    id: "net.remote-access",
    pillar: "network",
    phase: 1,
    weight: 2,
    prompt:
      "Do people working remotely reach company systems securely, without shared logins or open remote desktop?",
    whyItMatters:
      "Exposed remote desktop and shared remote logins are among the most common ransomware entry points.",
  },
  {
    id: "app.shared-documents",
    pillar: "applications",
    phase: 3,
    weight: 1,
    prompt:
      "Are company documents kept in one shared, organised place, not on personal laptops or in email attachments?",
    whyItMatters:
      "AI assistants can only answer from documents they can find, and so can new staff.",
  },
  {
    id: "data.cloud-backup",
    pillar: "data",
    phase: 2,
    weight: 2,
    prompt:
      "Is data in cloud tools (email, Microsoft 365 or Google Workspace, CRM) backed up separately from the provider?",
    whyItMatters:
      "Cloud providers keep their service running; restoring your deleted or encrypted data is usually your job.",
  },
  {
    id: "data.customer-data",
    pillar: "data",
    phase: 3,
    weight: 2,
    prompt: "Do you know what personal data you hold about customers, and how long you keep it?",
    whyItMatters:
      "Data protection rules apply to small businesses too, and AI tools must not see more than they need.",
  },
  {
    id: "vis.incident-plan",
    pillar: "visibility",
    phase: 1,
    weight: 2,
    prompt:
      "If you were hacked tomorrow, does the team know who to call and what to do in the first hour?",
    whyItMatters: "The first hour decides how much is lost. A one-page plan beats improvising.",
  },
  {
    id: "vis.website-uptime",
    pillar: "visibility",
    phase: 3,
    weight: 1,
    prompt: "Would you know within an hour if your website or online booking stopped working?",
    whyItMatters: "Every hour offline is lost enquiries that quietly go to a competitor.",
  },
];
