import { AREAS, type Area, PHASES, PILLARS } from "./areas";

/** Everyday words people use for each area, beyond the area's own titles. */
const KEYWORDS: Record<string, string[]> = {
  "company-context": [
    "it strategy",
    "roadmap",
    "budget",
    "documentation",
    "documented",
    "policy",
    "policies",
    "governance",
    "who runs it",
    "it support",
    "helpdesk process",
    "sla",
    "incident process",
    "change management",
    "where to start",
    "start",
  ],
  "identity-access": [
    "login",
    "log in",
    "password",
    "passwords",
    "mfa",
    "2fa",
    "two-step",
    "two step",
    "two-factor",
    "authenticator",
    "single sign-on",
    "sso",
    "active directory",
    "entra",
    "ldap",
    "admin account",
    "admin rights",
    "access",
    "permissions",
    "break-glass",
    "conditional access",
    "guest access",
  ],
  "servers-storage": [
    "server",
    "servers",
    "server room",
    "datacenter",
    "data center",
    "rack",
    "ups",
    "virtualisation",
    "virtualization",
    "vmware",
    "hyper-v",
    "proxmox",
    "storage",
    "nas",
    "san",
    "raid",
    "disk",
    "file share",
  ],
  "linux-engineering": [
    "linux",
    "rhel",
    "ssh",
    "nomachine",
    "vnc",
    "jump server",
    "bastion",
    "eda",
    "licence server",
    "license server",
    "flexnet",
    "nfs",
    "engineering tools",
  ],
  "compute-farm": [
    "hpc",
    "cluster",
    "slurm",
    "lsf",
    "scheduler",
    "compute farm",
    "simulation",
    "jobs",
    "queue",
  ],
  devops: [
    "git",
    "gitlab",
    "github",
    "svn",
    "repository",
    "repo",
    "ci",
    "cd",
    "ci/cd",
    "pipeline",
    "jenkins",
    "docker",
    "container",
    "kubernetes",
    "ansible",
    "devops",
    "code",
  ],
  endpoints: [
    "laptop",
    "laptops",
    "computer",
    "computers",
    "desktop",
    "pc",
    "mac",
    "device",
    "devices",
    "mdm",
    "intune",
    "jamf",
    "antivirus",
    "edr",
    "xdr",
    "malware",
    "encryption",
    "bitlocker",
    "filevault",
    "stolen",
    "lost laptop",
    "updates",
    "usb",
    "laps",
  ],
  workplace: [
    "office",
    "desk",
    "meeting room",
    "conference room",
    "printer",
    "printing",
    "scanner",
    "lab",
    "laboratory",
    "instrument",
    "cctv",
    "camera",
    "badge",
    "alarm",
    "visitor",
  ],
  network: [
    "network",
    "wifi",
    "wi-fi",
    "wireless",
    "firewall",
    "vpn",
    "router",
    "switch",
    "vlan",
    "segmentation",
    "internet",
    "broadband",
    "dhcp",
    "dns server",
    "remote access",
  ],
  "web-public": [
    "website",
    "web site",
    "domain",
    "dns",
    "registrar",
    "ssl",
    "tls",
    "certificate",
    "https",
    "cloudflare",
    "waf",
    "ddos",
    "customer portal",
    "social media",
    "linkedin",
    "facebook",
    "instagram",
  ],
  cloud: [
    "cloud",
    "aws",
    "azure",
    "gcp",
    "google cloud",
    "ec2",
    "s3",
    "cloud bill",
    "cloud cost",
    "expressroute",
    "direct connect",
  ],
  monitoring: [
    "monitoring",
    "monitor",
    "alert",
    "alerts",
    "alerting",
    "logs",
    "logging",
    "grafana",
    "prometheus",
    "uptime",
    "on-call",
    "dashboard",
    "runbook",
    "outage",
  ],
  "backup-recovery": [
    "backup",
    "backups",
    "back up",
    "back it up",
    "back them up",
    "restore",
    "recovery",
    "disaster",
    "ransomware",
    "rto",
    "rpo",
    "business continuity",
    "lost data",
    "deleted",
    "veeam",
    "immutable",
    "offline copy",
  ],
  "productivity-suite": [
    "email",
    "e-mail",
    "mail",
    "outlook",
    "calendar",
    "microsoft 365",
    "office 365",
    "m365",
    "google workspace",
    "gmail",
    "teams",
    "zoom",
    "google meet",
    "sharepoint",
    "onedrive",
    "google drive",
    "spam",
    "templates",
    "file sharing",
  ],
  "business-apps": [
    "saas",
    "subscription",
    "subscriptions",
    "hr system",
    "finance",
    "accounting",
    "e-signature",
    "docusign",
    "ticketing",
    "knowledge base",
    "power automate",
    "power apps",
    "low-code",
    "no-code",
    "automation",
    "power bi",
    "reporting",
    "reports",
  ],
  "user-lifecycle": [
    "onboarding",
    "offboarding",
    "new hire",
    "new starter",
    "joiner",
    "leaver",
    "leaves",
    "someone leaves",
    "employee leaves",
    "first day",
    "last day",
    "former employee",
  ],
  "assets-vendors": [
    "asset",
    "assets",
    "inventory",
    "supplier",
    "suppliers",
    "vendor",
    "vendors",
    "contract",
    "contracts",
    "renewal",
    "licence",
    "licences",
    "license",
    "licenses",
    "warranty",
    "costs",
    "spend",
  ],
  ai: [
    "ai",
    "artificial intelligence",
    "chatgpt",
    "copilot",
    "gemini",
    "claude",
    "llm",
    "agent",
    "agents",
    "agentic",
    "ai policy",
    "deepfake",
    "voice cloning",
    "gpu",
    "eu ai act",
  ],
  "security-compliance": [
    "security",
    "secure",
    "cyber",
    "cybersecurity",
    "hacked",
    "hack",
    "attack",
    "vulnerability",
    "vulnerabilities",
    "patch",
    "patching",
    "penetration test",
    "pentest",
    "siem",
    "gdpr",
    "iso 27001",
    "iso",
    "compliance",
    "audit",
    "risk register",
    "password vault",
    "secrets",
    "api key",
    "phishing",
    "incident",
  ],
};

const normalise = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9/+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

function score(question: string, area: Area): number {
  const q = normalise(question);
  let total = 0;
  for (const word of KEYWORDS[area.slug] ?? []) {
    if (q.includes(` ${word} `)) total += word.includes(" ") ? 2 : 1;
  }
  if (q.includes(` ${area.title.toLowerCase()} `)) total += 3;
  return total;
}

/**
 * The area a question is most likely about, or null if none matches. On an area page the
 * current area wins ties and is used when the question names no area at all ("how long does
 * it take?").
 */
export function pickArea(question: string, currentSlug?: string): Area | null {
  const current = currentSlug ? getArea(currentSlug) : undefined;
  let best: Area | null = null;
  let bestScore = 0;
  for (const area of AREAS) {
    const s = score(question, area) + (area === current ? 0.5 : 0);
    if (s > bestScore) {
      best = area;
      bestScore = s;
    }
  }
  if (best && bestScore >= 1) return best;
  return current ?? null;
}

export function getArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

/** The guide's areas for one area page path, e.g. "/guide/backup-recovery". */
export const areaPath = (area: Area) => `/guide/${area.slug}`;

/**
 * One area as compact, deterministic text for an AI prompt. The same area always gives the
 * same bytes, so provider prompt caches keep hitting.
 */
export function compactArea(area: Area): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    `AREA: ${area.title} (${area.technical}). Page: ${areaPath(area)}. Pillar: ${PILLARS[area.pillar].name}. Priority: ${PHASES[area.phase].name}.`,
    area.summary,
    `Why: ${area.whyItMatters}`,
    `Parts:\n${area.parts.map((p) => `- ${p.name}: ${p.plain}`).join("\n")}`,
    `Warning signs:\n${list(area.warningSigns)}`,
    `Quick wins:\n${list(area.quickWins)}`,
    `Ask your IT person:\n${list(area.questions)}`,
  ].join("\n");
}

/** A one-line-per-area index, for questions that match no single area. */
export function guideIndex(): string {
  return AREAS.map((a) => `- ${a.title} (${areaPath(a)}): ${a.oneLiner}`).join("\n");
}

const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

/**
 * Answers a few clear question shapes straight from the guide, with no AI call. Returns null
 * whenever the question needs real reasoning.
 */
export function instantAnswer(question: string, currentSlug?: string): string | null {
  const q = question.trim().toLowerCase();
  if (q.split(/\s+/).length > 10) return null;
  const area = pickArea(question, currentSlug);
  if (!area) return null;
  if (
    /\b(quick wins?|first steps?|where (do|should) (i|we) start|what should (i|we) do first)\b/.test(
      q,
    )
  ) {
    return `Quick wins for ${area.title.toLowerCase()}:\n${bullets(area.quickWins)}`;
  }
  if (/\b(questions?|what should i ask|what to ask)\b/.test(q)) {
    return `Good questions to ask whoever runs your IT:\n${bullets(area.questions)}`;
  }
  if (/\b(warning signs?|red flags?|signs of trouble)\b/.test(q)) {
    return `You might have a gap if:\n${bullets(area.warningSigns)}`;
  }
  if (/^(what is|what's|what are|explain|tell me about)\b/.test(q) && score(question, area) >= 1) {
    return `${area.summary} ${area.whyItMatters}`;
  }
  return null;
}

/** A useful answer from the guide alone, for when no AI is available. */
export function fallbackAnswer(question: string, currentSlug?: string): string {
  const area = pickArea(question, currentSlug);
  if (!area) {
    return `I can't reach the AI right now, but the guide covers these areas:\n${AREAS.map((a) => `• ${a.title}`).join("\n")}\nPick one, or book a call and we'll help with your specific setup.`;
  }
  return `I can't reach the AI right now, so here is what the guide says about ${area.title.toLowerCase()}. ${area.summary}\n\nQuick wins:\n${bullets(area.quickWins)}`;
}
