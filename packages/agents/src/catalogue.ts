import { MORE_AGENTS } from "./more-agents";
import type { Workflow } from "./workflow";

export type AgentCategory = "customers" | "sales" | "operations" | "finance" | "team";

/** Business areas, in display order. */
export const CATEGORIES: { id: AgentCategory; name: string; intro: string }[] = [
  {
    id: "customers",
    name: "Customers",
    intro: "Answer, book and look after customers around the clock.",
  },
  { id: "sales", name: "Sales", intro: "Reply to leads fast, quote accurately and follow up." },
  { id: "operations", name: "Operations", intro: "Keep inboxes, schedules and orders moving." },
  { id: "finance", name: "Finance", intro: "Process invoices and get paid on time." },
  { id: "team", name: "Your team", intro: "Give everyone answers, notes and numbers in seconds." },
];

export interface Agent {
  slug: string;
  category: AgentCategory;
  name: string;
  /** One line for cards. */
  tagline: string;
  summary: string;
  /** What it does, as short capability lines. */
  capabilities: string[];
  /** A typical deployment, drawn as a diagram. */
  workflow: Workflow;
  /** What we track once it runs. Metrics, not promises. */
  measures: string[];
  /** Everyday words that point to this agent, for matching a visitor's task. */
  keywords: string[];
  /** Live demo on this site, if any. */
  demo?: { href: string; label: string };
}

const CORE_AGENTS: Agent[] = [
  {
    slug: "voice-agent",
    category: "customers",
    name: "Voice agent",
    tagline: "Answers every call, books appointments and hands off what needs a person.",
    summary:
      "A phone agent that picks up 24/7, understands natural speech, answers questions from your own information, books into your calendar and passes urgent or unusual calls to your team with a summary.",
    capabilities: [
      "Natural phone conversations, interruptions and corrections included",
      "Books, moves and cancels appointments in your calendar",
      "Answers hours, prices and policy questions from your own facts",
      "Escalates urgent calls with a written summary",
    ],
    workflow: {
      title: "Inbound call to booked appointment",
      steps: [
        {
          kind: "trigger",
          label: "Call comes in",
          detail: "Any time, including evenings and weekends.",
        },
        {
          kind: "agent",
          label: "Understand the caller",
          detail: "Works out what they need and checks unclear details.",
        },
        {
          kind: "tool",
          label: "Check the calendar",
          detail: "Finds real free times; never invents one.",
        },
        {
          kind: "agent",
          label: "Propose and read back",
          detail: "Offers two options and confirms every detail.",
        },
        {
          kind: "human",
          label: "Urgent or unusual?",
          detail: "Hands the call or a summary to your team.",
        },
        {
          kind: "output",
          label: "Booking confirmed",
          detail: "Saved in the calendar with a reference.",
        },
      ],
      integrations: ["Phone line", "Google Calendar", "Outlook", "Cal.com"],
      guardrails: [
        "Books only after the caller clearly says yes",
        "Never gives medical, legal or pricing promises outside your facts",
        "Says it is an AI when asked",
      ],
    },
    measures: ["Calls answered", "Bookings made", "Calls handed to staff", "Average call length"],
    keywords: [
      "call",
      "calls",
      "phone",
      "phones",
      "receptionist",
      "booking",
      "bookings",
      "appointment",
      "appointments",
      "voicemail",
      "missed calls",
      "reception",
    ],
    demo: { href: "/receptionist", label: "Call the live demo" },
  },
  {
    slug: "inbox-agent",
    category: "operations",
    name: "Inbox agent",
    tagline: "Reads, sorts and drafts replies to your email so your team only approves.",
    summary:
      "An email agent that reads every incoming message, works out what it is, pulls the facts it needs from your systems, drafts the reply and files attachments. Your team reviews and sends.",
    capabilities: [
      "Sorts mail into requests, orders, invoices, complaints and noise",
      "Drafts replies in your tone using your own information",
      "Extracts data from attachments into your systems",
      "Flags anything urgent or risky",
    ],
    workflow: {
      title: "Shared inbox to approved reply",
      steps: [
        {
          kind: "trigger",
          label: "New email arrives",
          detail: "In a shared inbox such as info@ or orders@.",
        },
        {
          kind: "agent",
          label: "Classify and extract",
          detail: "Request type, customer, order number, dates.",
        },
        {
          kind: "tool",
          label: "Look up the facts",
          detail: "Order status, customer record, policy.",
        },
        {
          kind: "agent",
          label: "Draft the reply",
          detail: "In your tone, with the facts it found.",
        },
        {
          kind: "human",
          label: "Approve or edit",
          detail: "One click to send; nothing goes out unseen.",
        },
        {
          kind: "output",
          label: "Reply sent and logged",
          detail: "Ticket or CRM updated automatically.",
        },
      ],
      integrations: ["Gmail", "Outlook", "HubSpot", "Zendesk"],
      guardrails: [
        "Drafts only: a person approves every outgoing email at first",
        "Never shares data from one customer with another",
        "Refunds and discounts always go to a person",
      ],
    },
    measures: ["Emails handled", "Time to first reply", "Drafts sent without edits", "Escalations"],
    keywords: [
      "email",
      "emails",
      "inbox",
      "mail",
      "reply",
      "replies",
      "outlook",
      "gmail",
      "messages",
      "enquiries",
      "inquiries",
    ],
  },
  {
    slug: "knowledge-agent",
    category: "team",
    name: "Knowledge agent",
    tagline: "Answers questions from your documents, with the source for every answer.",
    summary:
      "An assistant for your team or customers that searches your manuals, contracts, policies and wiki, answers in plain language and shows exactly where each answer came from.",
    capabilities: [
      "Searches documents, drives and wikis in seconds",
      "Shows the source passage for every answer",
      "Respects who may see which documents",
      "Says it does not know instead of guessing",
    ],
    workflow: {
      title: "Question to sourced answer",
      steps: [
        {
          kind: "trigger",
          label: "Someone asks a question",
          detail: "In chat, Teams, Slack or on your website.",
        },
        {
          kind: "tool",
          label: "Search your documents",
          detail: "Only the ones this person may see.",
        },
        {
          kind: "agent",
          label: "Write the answer",
          detail: "Plain language, grounded in what it found.",
        },
        {
          kind: "agent",
          label: "Check the sources",
          detail: "Every claim must point to a passage.",
        },
        { kind: "output", label: "Answer with sources", detail: "Links to the exact pages used." },
        {
          kind: "human",
          label: "Feedback loop",
          detail: "Wrong answers are flagged and fixed weekly.",
        },
      ],
      integrations: ["SharePoint", "Google Drive", "Notion", "Confluence", "Slack", "Teams"],
      guardrails: [
        "Answers only from approved sources",
        "Never reveals documents a person cannot open",
        "Says \"I don't know\" when the sources don't cover it",
      ],
    },
    measures: ["Questions answered", "Answers with sources", "Flagged answers", "Searches saved"],
    keywords: [
      "documents",
      "document",
      "docs",
      "knowledge",
      "wiki",
      "manual",
      "manuals",
      "policies",
      "contracts",
      "search",
      "handbook",
      "sharepoint",
      "faq",
      "faqs",
    ],
  },
  {
    slug: "sales-agent",
    category: "sales",
    name: "Sales agent",
    tagline: "Qualifies new leads in minutes, follows up and books the meeting.",
    summary:
      "A lead agent that responds to every enquiry within minutes, asks the qualifying questions, enriches the record, books qualified leads into your calendar and keeps following up politely.",
    capabilities: [
      "Replies to new leads within minutes, day or night",
      "Asks your qualifying questions naturally",
      "Updates the CRM with notes and a score",
      "Books meetings and sends reminders",
    ],
    workflow: {
      title: "Web enquiry to booked sales call",
      steps: [
        { kind: "trigger", label: "New lead", detail: "Website form, ad, chat or email." },
        {
          kind: "agent",
          label: "Qualify the lead",
          detail: "Budget, timing and fit, in a short conversation.",
        },
        { kind: "tool", label: "Update the CRM", detail: "Contact, notes and lead score." },
        {
          kind: "human",
          label: "Sales reviews hot leads",
          detail: "Big or unusual deals go to a person.",
        },
        { kind: "agent", label: "Book and follow up", detail: "Offers times and chases politely." },
        { kind: "output", label: "Meeting booked", detail: "In the right salesperson's calendar." },
      ],
      integrations: ["HubSpot", "Pipedrive", "Salesforce", "Calendly", "Gmail"],
      guardrails: [
        "Never quotes prices or discounts outside your rules",
        "Stops contacting anyone who asks it to",
        "Every message is logged in the CRM",
      ],
    },
    measures: ["Speed to first reply", "Leads qualified", "Meetings booked", "Follow-ups sent"],
    keywords: [
      "lead",
      "leads",
      "sales",
      "prospects",
      "crm",
      "hubspot",
      "pipedrive",
      "salesforce",
      "follow up",
      "follow-up",
      "deals",
    ],
  },
  {
    slug: "back-office-agent",
    category: "finance",
    name: "Back-office agent",
    tagline: "Moves data between systems: invoices, orders, receipts and reports.",
    summary:
      "An operations agent that reads invoices, receipts, orders and forms, checks them against your rules and enters them into your accounting or ERP system, so nobody retypes data again.",
    capabilities: [
      "Reads invoices, receipts and PDFs, even scans",
      "Checks totals, VAT and purchase orders",
      "Enters data into accounting and ERP systems",
      "Sends exceptions to a person with the reason",
    ],
    workflow: {
      title: "Supplier invoice to booked entry",
      steps: [
        { kind: "trigger", label: "Invoice received", detail: "By email, upload or scan." },
        {
          kind: "agent",
          label: "Read the invoice",
          detail: "Supplier, amounts, VAT, due date, lines.",
        },
        { kind: "tool", label: "Match the order", detail: "Checks it against the purchase order." },
        {
          kind: "human",
          label: "Approve exceptions",
          detail: "Mismatches and large amounts go to finance.",
        },
        {
          kind: "tool",
          label: "Post to accounting",
          detail: "Entered with the document attached.",
        },
        { kind: "output", label: "Ready to pay", detail: "Audit trail kept for every step." },
      ],
      integrations: ["Xero", "QuickBooks", "Exact", "SAP Business One", "Google Sheets"],
      guardrails: [
        "Never makes payments",
        "Large or unusual amounts always need a person",
        "Keeps a full audit trail",
      ],
    },
    measures: ["Documents processed", "Exceptions", "Processing time", "Hours of data entry saved"],
    keywords: [
      "invoice",
      "invoices",
      "receipts",
      "receipt",
      "accounting",
      "bookkeeping",
      "data entry",
      "erp",
      "orders",
      "order",
      "spreadsheet",
      "spreadsheets",
      "excel",
      "xero",
      "quickbooks",
      "finance",
      "reports",
      "reporting",
    ],
  },
  {
    slug: "support-agent",
    category: "customers",
    name: "Support agent",
    tagline: "Resolves customer questions in chat and WhatsApp, escalates the rest.",
    summary:
      "A customer support agent on your website, WhatsApp or help desk that answers questions, tracks orders, opens tickets and hands complex cases to your team with the full context.",
    capabilities: [
      "Answers in chat, WhatsApp and your help desk",
      "Looks up orders, bookings and account status",
      "Opens and updates tickets",
      "Hands over to a person with the full conversation",
    ],
    workflow: {
      title: "Customer chat to resolved ticket",
      steps: [
        { kind: "trigger", label: "Customer writes", detail: "Website chat, WhatsApp or email." },
        {
          kind: "agent",
          label: "Understand the issue",
          detail: "Asks one clear question at a time.",
        },
        { kind: "tool", label: "Check order or account", detail: "Status, delivery, invoices." },
        { kind: "agent", label: "Resolve or explain", detail: "Answers from your policies." },
        {
          kind: "human",
          label: "Hand over if needed",
          detail: "Complaints and special cases go to staff.",
        },
        { kind: "output", label: "Ticket closed", detail: "Summary and tags saved automatically." },
      ],
      integrations: ["WhatsApp", "Intercom", "Zendesk", "Freshdesk", "Shopify"],
      guardrails: [
        "Never changes orders or refunds without approval",
        "Always offers a human",
        "No personal data in training or logs beyond what you allow",
      ],
    },
    measures: ["Conversations resolved", "Handovers", "Customer rating", "Response time"],
    keywords: [
      "support",
      "customer",
      "customers",
      "chat",
      "whatsapp",
      "tickets",
      "ticket",
      "helpdesk",
      "help desk",
      "complaints",
      "returns",
      "shopify",
      "orders status",
    ],
  },
];

export const AGENTS: Agent[] = [...CORE_AGENTS, ...MORE_AGENTS];

export function getAgent(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}
