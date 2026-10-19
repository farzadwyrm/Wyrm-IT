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
    slug: "five-questions-before-adding-ai",
    title: "Five questions to answer before adding AI to your business",
    summary:
      "AI tools are easy to try and easy to get wrong. These five questions take an hour and save months.",
    date: "2026-10-19",
    body: [
      "Most small businesses do not fail with AI because the technology is weak. They fail because AI was connected to messy accounts, unknown data or a process nobody owned. Answer these five questions first.",
      "## 1. Which task costs us the most time each week?",
      "Pick one repetitive, well-understood task: answering the same phone questions, searching for documents, typing data from emails into another system. A narrow target is easier to measure and easier to trust.",
      "## 2. Where does the data for that task live?",
      "List the apps, drives and inboxes involved. If you cannot say where the data is, you cannot safely give an AI tool access to it, and you cannot back it up either.",
      "## 3. Who can log in to those systems, and is two-step sign-in on?",
      "An AI assistant usually inherits someone's access. If former staff still have accounts, or passwords are shared, fix that first. It is cheaper than any incident.",
      "## 4. What must a person always check?",
      "Decide up front which AI outputs go straight to customers and which need a human review. Bookings, prices and anything legal should start with review.",
      "## 5. How will we know it worked?",
      "Choose one number before you start: calls answered, hours saved, response time. Measure it for two weeks before and after.",
      "If you can answer all five, you are ready for a small pilot. If not, our free AI-Readiness Scan is a good place to start.",
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
