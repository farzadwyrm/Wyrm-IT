import type { Pillar } from "./types";

export interface PillarInfo {
  label: string;
  /** One line shown above the questions for this area. */
  intro: string;
}

/** Plain-language names for each area, in the order the scan asks them. */
export const PILLAR_INFO: Record<Pillar, PillarInfo> = {
  foundation: {
    label: "Ownership & planning",
    intro: "Who looks after IT, and what the business cannot do without.",
  },
  identity: {
    label: "Accounts & access",
    intro: "Who can log in to what, and how well those logins are protected.",
  },
  devices: {
    label: "Laptops & phones",
    intro: "The computers and phones your team uses for work.",
  },
  network: {
    label: "Office & remote network",
    intro: "Your internet connection, Wi-Fi and how people connect from home.",
  },
  applications: {
    label: "Software & AI use",
    intro: "The tools you pay for, where documents live and how AI is used today.",
  },
  data: {
    label: "Data & backups",
    intro: "Where your data lives and whether you could get it back.",
  },
  visibility: {
    label: "Monitoring & response",
    intro: "Whether you would notice a problem, and what happens next.",
  },
};

export interface ReadinessBand {
  label: string;
  summary: string;
}

/** Turns an overall score into a short verdict. Thresholds are inclusive lower bounds. */
export function readinessBand(score: number): ReadinessBand {
  if (score >= 75) {
    return {
      label: "Ready to pilot AI",
      summary:
        "Your foundations are in good shape. A focused AI pilot on one time-consuming task is a sensible next step.",
    };
  }
  if (score >= 45) {
    return {
      label: "Nearly ready",
      summary:
        "Most basics are in place. Close the top gaps below first, then AI can be connected safely.",
    };
  }
  return {
    label: "Foundations first",
    summary:
      "Some important basics are missing. Fixing them protects the business today and makes AI safe to add later.",
  };
}
