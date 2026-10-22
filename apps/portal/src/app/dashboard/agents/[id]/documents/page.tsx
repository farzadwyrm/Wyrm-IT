import { knowledgeStats, listKnowledgeSources } from "@wyrm/core";
import type { Metadata } from "next";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Card, Empty, input, Notice, primary, secondary } from "../../../ui";
import {
  addTextAction,
  addWebsiteAction,
  deleteDocumentAction,
  uploadDocumentsAction,
} from "./actions";
import { DrivePicker } from "./drive-picker";

export const metadata: Metadata = { title: "Documents" };

const KIND_LABELS = {
  upload: "File",
  website: "Web page",
  google_drive: "Google Drive",
  text: "Pasted text",
} as const;

/** Documents: what the agent knows. Added documents are used straight away (no publish step). */
export default async function DocumentsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/documents">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const [sources, stats] = await Promise.all([
    listKnowledgeSources(page.ctx, page.tenantId, id),
    knowledgeStats(page.ctx, page.tenantId, id),
  ]);
  const canEdit = page.can("agents.configure", id) && !page.readOnly;
  const hidden = <input type="hidden" name="agentId" value={id} />;
  const googleClient = process.env.GOOGLE_CLIENT_ID?.trim();
  const pickerKey = process.env.GOOGLE_PICKER_API_KEY?.trim();
  const added = typeof query.n === "string" ? Number.parseInt(query.n, 10) || 0 : 0;
  const failed = typeof query.failed === "string" ? query.failed.slice(0, 300) : "";

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-ink-muted">
        Add the documents your team asks about: handbooks, policies, price lists, procedures. The
        agent answers only from these and shows which document each answer came from. New documents
        are used straight away.
      </p>
      <Notice params={query} />
      {added > 1 && (
        <p role="status" className="text-sm text-ink-muted">
          {added} documents added.
        </p>
      )}
      {failed && (
        <p role="alert" className="text-sm text-node-output">
          Couldn't read: {failed}.
        </p>
      )}

      <ul className="grid grid-cols-3 gap-3">
        {[
          ["Documents", stats.sources],
          ["Searchable passages", stats.passages],
          ["Questions this week", stats.askedWeek],
        ].map(([label, value]) => (
          <li key={label} className="rounded-2xl border border-line bg-paper-raised/80 p-3">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Upload files</h2>
            <form action={uploadDocumentsAction} className="space-y-3">
              {hidden}
              <input
                type="file"
                name="files"
                multiple
                required
                accept=".pdf,.docx,.txt,.md,.csv,.html,.htm,.json"
                aria-label="Files to upload"
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-paper file:px-4 file:font-semibold file:text-ink"
              />
              <p className="text-xs text-ink-muted">
                PDF, Word (.docx), text, Markdown, CSV or HTML. Up to 10 files and 4 MB per upload.
                Scanned PDFs (pictures of text) can't be read.
              </p>
              <button type="submit" className={primary}>
                Upload
              </button>
            </form>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Google Drive</h2>
            {googleClient && pickerKey ? (
              <>
                <p className="text-sm text-ink-muted">
                  Pick Google Docs, Sheets, Slides, PDFs or Word files. The agent only gets the
                  files you choose. To update one, pick it again.
                </p>
                <DrivePicker agentId={id} clientId={googleClient} apiKey={pickerKey} />
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Google Drive import is being switched on by Wyrm. Until then, download the file and
                upload it here.
              </p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Web pages</h2>
            <form action={addWebsiteAction} className="space-y-3">
              {hidden}
              <label className="block">
                <span className="text-sm font-semibold">Address</span>
                <input
                  name="url"
                  required
                  maxLength={300}
                  className={input}
                  placeholder="e.g. yourcompany.com/help"
                />
              </label>
              <fieldset className="flex flex-wrap gap-4 text-sm">
                <legend className="sr-only">How much to read</legend>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="scope" value="page" defaultChecked /> This page only
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="scope" value="site" /> This page and up to 9 linked
                  pages
                </label>
              </fieldset>
              <p className="text-xs text-ink-muted">
                Public pages only. Adding the same address again updates it.
              </p>
              <button type="submit" className={secondary}>
                Add web page
              </button>
            </form>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Paste text</h2>
            <form action={addTextAction} className="space-y-3">
              {hidden}
              <label className="block">
                <span className="text-sm font-semibold">Name</span>
                <input
                  name="name"
                  required
                  maxLength={200}
                  className={input}
                  placeholder="e.g. Returns process"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Text</span>
                <textarea name="text" required rows={5} maxLength={200000} className={input} />
              </label>
              <button type="submit" className={secondary}>
                Add text
              </button>
            </form>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          Documents <span className="text-ink-muted">({sources.length})</span>
        </h2>
        {sources.length === 0 ? (
          <Empty>No documents yet. Add a few above, then try a question on the Ask tab.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[600px] text-left text-sm">
              <caption className="sr-only">Documents this agent answers from</caption>
              <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    From
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Passages
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="max-w-80 px-4 py-3">
                      {s.kind === "website" && s.location ? (
                        <a
                          href={s.location}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-semibold break-all hover:text-ember"
                        >
                          {s.name}
                        </a>
                      ) : (
                        <span className="font-semibold break-all">{s.name}</span>
                      )}
                      {s.status === "error" && (
                        <span className="ml-2">
                          <Badge tone="bad">error</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{KIND_LABELS[s.kind]}</td>
                    <td className="px-4 py-3 text-right">{s.chunkCount}</td>
                    <td className="px-4 py-3 text-ink-muted">{when(s.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <form action={deleteDocumentAction}>
                          {hidden}
                          <input type="hidden" name="sourceId" value={s.id} />
                          <button
                            type="submit"
                            className="text-xs text-ink-muted hover:text-node-output"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
