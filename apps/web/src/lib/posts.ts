/**
 * Blog posts as typed data. Each paragraph is plain text; headings start with "## ".
 * Keep posts practical, written for non-technical business owners, with no client names.
 */
export interface Post {
  slug: string;
  title: string;
  summary: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  body: readonly string[];
}

export const POSTS: readonly Post[] = [
  {
    slug: "five-questions-before-your-first-ai-agent",
    title: "Five questions to answer before you deploy your first AI agent",
    summary:
      "Agents are easy to demo and easy to get wrong in production. These five questions take an hour and save months.",
    date: "2026-10-20",
    body: [
      "Most first agents do not fail because the model is weak. They fail because nobody defined the workflow, the limits or what success looks like. Answer these five questions first.",
      "## 1. Which workflow costs us the most hours each week?",
      "Pick one repetitive, well-understood workflow: answering the same calls, sorting a shared inbox, typing invoices into accounting, chasing new leads. A narrow target is easier to build, measure and trust.",
      "## 2. What starts it, and where does it end?",
      "Write down the trigger (an email arrives, a call comes in, a form is submitted) and the finished result (a booking, a sent reply, an entry in Xero). Everything in between is what the agent will do.",
      "## 3. Which systems must the agent read and write?",
      "List the calendar, inbox, CRM or accounting tools involved, and give the agent only the access it needs. Least privilege and a full log of every action are not optional.",
      "## 4. Where must a person decide?",
      "Decide up front which steps the agent may complete alone and which need a human check. Money, refunds, legal wording and unhappy customers should start with approval.",
      "## 5. How will we know it works?",
      "Choose a few numbers before you start: calls answered, time to first reply, invoices processed, hours saved. Test the agent on real past cases before go-live, then measure every month.",
      "If you can answer all five, you are ready for a first agent. Our free workflow analysis walks you through all five in about seven minutes.",
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug);
}

/** Newest first. */
export function sortedPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
}
