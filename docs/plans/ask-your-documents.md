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

## Live connections (read only): databases, CRM, SharePoint, own search API

My agent → **Connections** (owners and admins only: `security.manage` plus `agents.configure`).
Read-only is enforced three times:

1. **When connecting**, Wyrm tests the account and refuses it if it can change anything
   (Postgres: no superuser/role rights and no INSERT/UPDATE/DELETE/TRUNCATE on any table;
   MySQL: grants are SELECT only; SQL Server: not sysadmin/db_owner/db_datawriter/db_ddladmin
   and no write permissions; HubSpot: every token scope ends in `.read`; Microsoft: no
   write scopes are granted). Only connections that pass ("Read-only ✓") are used.
2. **Approved lookups only.** The manager writes each lookup once: a name, "use it when…",
   and one SELECT with `:name` values (or a HubSpot object to search). Wyrm rejects anything
   that isn't a single SELECT (no comments, no INSERT/UPDATE/DELETE/DDL/EXEC/INTO/locks/sleep).
   While answering, the model may only pick a lookup by number and copy values from the
   question; it never writes SQL. Values are bound as parameters, never pasted into the query.
3. **At run time**: TLS, a public host only, a read-only transaction (Postgres, MySQL), a
   5-second limit and at most 50 rows. Every run is logged (who, lookup, values, rows, time)
   on the Connections tab. Results are passed to the answer as cited "live data" and not stored.

Passwords and tokens are encrypted (AES-256-GCM) and can't be viewed again by anyone.

### What the client prepares

**PostgreSQL** (run as an admin; views are best, so Wyrm sees only what it needs):

```sql
create role wyrm_readonly login password '<strong password>';
grant connect on database shop to wyrm_readonly;
grant usage on schema public to wyrm_readonly;
grant select on orders_v, stock_v to wyrm_readonly;   -- or: on all tables in schema public
revoke create on schema public from public;            -- recommended
```

**MySQL / MariaDB:**

```sql
CREATE USER 'wyrm_readonly'@'%' IDENTIFIED BY '<strong password>' REQUIRE SSL;
GRANT SELECT ON shop.orders_v TO 'wyrm_readonly'@'%';
```

**SQL Server:**

```sql
CREATE LOGIN wyrm_readonly WITH PASSWORD = '<strong password>';
USE Shop; CREATE USER wyrm_readonly FOR LOGIN wyrm_readonly;
ALTER ROLE db_datareader ADD MEMBER wyrm_readonly;   -- or GRANT SELECT ON dbo.OrdersView
```

**Network:** Wyrm connects from Vercel, which has no fixed IP address on the free plan, so the
database must accept TLS connections from the internet (cloud databases such as Azure SQL,
AWS RDS, Supabase or Neon do). Databases inside an office network should use the **search
API** below instead (a small service next to the database that Wyrm calls over https).

**HubSpot:** Settings → Integrations → Private apps → Create a private app → Scopes: tick only
`.read` scopes (for example `crm.objects.contacts.read`, `crm.objects.companies.read`,
`crm.objects.deals.read`) → Create → copy the access token into Wyrm. Then approve a lookup
per object (for example "Find a customer: when someone asks about a customer's details").

**SharePoint / OneDrive:** Add connection → SharePoint → Sign in with Microsoft (asks only for
`Sites.Read.All`, `Files.Read.All`, `User.Read`; some organisations need their Microsoft 365
admin to approve the app once) → Choose a document library (and folder) → Sync now. New and
changed files (PDF, Word, text) are copied into the agent's documents, 15 per click; files
removed from the library are removed from the agent.

**Own search API** (for anything else, or data that must stay on the client's servers):

- Request: `POST <https address>` with JSON `{"question": "...", "user": "staff@client.example",
  "limit": 4}` and headers `X-Wyrm-Timestamp` (unix seconds) and `X-Wyrm-Signature:
  sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>`.
- The service should check the signature and that the timestamp is within 5 minutes, then
  search **with that user's permissions**.
- Reply within 6 seconds: `{"results": [{"title": "...", "text": "...", "url": "https://..."}]}`
  (up to 4 results, 200 KB).

### Wyrm one-time setup for SharePoint

1. Azure portal → Microsoft Entra ID → App registrations → New registration: name
   "Wyrm portal", supported accounts "Accounts in any organizational directory (multitenant)",
   redirect URI (Web) `https://wyrm-portal.vercel.app/api/connections/microsoft/callback`.
2. API permissions → Microsoft Graph → Delegated: `User.Read`, `Sites.Read.All`,
   `Files.Read.All`, `offline_access` (read only; nothing else).
3. Certificates & secrets → New client secret.
4. Vercel → `MICROSOFT_CLIENT_ID` (Application ID) and `MICROSOFT_CLIENT_SECRET` (Secret,
   Production) → redeploy. Until then SharePoint shows "being switched on".

Database: migration `packages/db/migrations/0009_connections.sql` (after 0008).

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
- Connections: migration `0009_connections.sql`; core `connections.ts` (+ test: SELECT checker,
  permissions, encrypted secrets, lookups while answering); planner `planLookup` in
  `brain-models.ts`; drivers in `apps/portal/src/lib/connectors/` (`sql.ts`, `hubspot.ts`,
  `sharepoint.ts`, `search-api.ts`, `index.ts`) with `connectors.test.ts`; UI
  `app/dashboard/agents/[id]/connections/`; Microsoft sign-in `app/api/connections/microsoft/`.
- Not verified against real customer systems yet: Postgres/MySQL/SQL Server/HubSpot/Graph
  calls are covered by unit tests and fakes only; test each with a real read-only account
  before a client relies on it.
