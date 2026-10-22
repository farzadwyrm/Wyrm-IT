# Ask your documents (internal knowledge agent)

An agent template for a client's staff: they ask questions in plain words and get answers taken
only from the client's own documents, with numbered sources they can open. It is internal: it
has no public chat page, no website widget, and customers' chats are never routed to it.

## How it works

1. **Sources.** A manager adds documents to the agent: uploaded files (PDF, Word .docx, text,
   Markdown, CSV, HTML), public web pages, files picked in Google Drive, or pasted text.
   Only the extracted text is kept, not the original file.
2. **Passages.** Each document is cut into passages of about 400 words on paragraph boundaries,
   with a short overlap and the nearest heading (`packages/core/src/knowledge.ts`, `chunkText`).
3. **Search.** Postgres full-text search over the agent's passages (`knowledge_chunks.search`,
   GIN index, `simple` dictionary so any language works). A free model first suggests other
   words the documents may use (synonyms, the formal term), then the best six passages are kept.
4. **Answer.** A free model (Groq) answers using only those passages and must cite them as
   [1], [2]. No passage found, or no citation in the answer, means "I couldn't find that in your
   documents". The agent's Rules and blocked topics (Limits) apply.
5. **Learning loop.** Every question is logged with its answer, sources and 👍/👎. The
   Questions tab lists the gaps (not found or marked wrong): each gap is a document to add.

Why keyword search and not embeddings: it is free, needs no extra service, works well at a small
business's scale (hundreds of documents), and the model widens the words. Embeddings (pgvector,
hybrid ranking) can be added later behind the same `searchKnowledge` function.

## Permissions

- **Ask:** anyone who may use the agent (`agents.use`). Owners and admins can use every agent;
  everyone else is given access on the agent's Go live tab ("Who can use this agent").
- **Manage documents:** `agents.configure`. **Read the question log:** `agents.logs`.
- **Sensitive documents** (HR, finance): put them in a separate agent and share it only with the
  right people. Passages are searched per agent, so one agent never sees another's documents.
- Organisations are isolated by `tenant_id` checks in code and database triggers.

## One-time setup by Wyrm (already shared with Google sign-in and Calendar)

Google Drive import needs these in the same Google Cloud project as sign-in. Everything here is
free; `drive.file` is a non-sensitive scope, so no Google verification is needed.

1. **APIs & Services → Library:** enable **Google Drive API** and **Google Picker API**.
2. **Google Auth Platform → Data access → Add or remove scopes:** add
   `https://www.googleapis.com/auth/drive.file`, then Save.
3. **Clients → Wyrm portal → Authorized JavaScript origins:** add
   `https://wyrm-portal.vercel.app`, then Save.
4. **APIs & Services → Credentials → Create credentials → API key.** Restrict it:
   application restrictions = Websites, `https://wyrm-portal.vercel.app/*`; API restrictions =
   Google Picker API only.
5. **Vercel → wyrm-portal → Settings → Environment Variables:** add `GOOGLE_PICKER_API_KEY`
   (the key from step 4, Production), then redeploy. `GOOGLE_CLIENT_ID` is already set.

Until step 5 is done, the Documents tab says Drive import is being switched on; uploads, web
pages and pasted text work without it.

Database: migration `packages/db/migrations/0008_knowledge.sql` (run once in the Supabase SQL
editor, after 0007).

## Setting it up for a client

1. **Back office → the client → Add an agent from a template → Ask your documents.** Give it
   a name (for example "Ask the handbook"). It starts as a draft.
2. **View as the owner (or the owner signs in) → My agent → Documents.** Add the handbook,
   policies, price lists and procedures.
3. **Ask tab:** ask at least 3 real questions and check the sources. Fix gaps by adding documents.
4. **Rules / Limits & handoff (optional):** for example "Never share salary details" as a rule,
   and who to ask when the documents don't say.
5. **Go live tab:** choose who can use the agent. Wyrm signs off in the back office, then the
   owner switches it on.
6. **Staff use it** in their portal: My agent → Ask. Managers watch the Questions tab weekly.

## Limits

Per agent: 300 documents and 4 million characters; 400,000 characters per document; 4 MB per
upload (Vercel's request limit); 10 files per upload; 10 web pages per web import. Scanned PDFs
(images of text) can't be read. Google Drive files are imported once: pick a file again to update
it (no background sync, and no Drive token is stored).

## Code map

- Data: `packages/db/migrations/0008_knowledge.sql`, `packages/db/src/schema.ts`.
- Core: `packages/core/src/knowledge.ts` (+ `knowledge.test.ts`); setup checklist in
  `onboarding.ts`; internal agents kept out of customer chat in `runtime.ts`
  (`INTERNAL_AGENT_TYPES`).
- Models: `packages/ai/src/brain-models.ts` (`expandQuestion`, `answerFromDocuments`).
- Portal: `apps/portal/src/lib/documents.ts` (file and Drive reading),
  `app/dashboard/agents/[id]/{ask,documents,questions}`, `launch/team-access.tsx`,
  back office "Add an agent" (`app/admin/actions.ts`, `addAgentAction`).
