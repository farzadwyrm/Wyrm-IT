import { EXPECTED_ACTIONS, type listTestsWithResults } from "@wyrm/core";
import { when } from "@/lib/portal";
import { Badge, Card, Empty, input, primary, secondary } from "../../../ui";
import { runTestsAction, saveTestAction, testActiveAction } from "./actions";

type Data = Awaited<ReturnType<typeof listTestsWithResults>>;

const ACTION_LABELS: Record<string, string> = {
  none: "No action",
  "book.request": "Booking request",
  "reschedule.request": "Move request",
  "cancel.held": "Cancellation (held for approval)",
  "message.request": "Message for the team",
  "transfer.request": "Pass to a person",
  "quote.held": "Quote (held for review)",
  "qualify.request": "Sales lead recorded",
};

function Check({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) return <Badge>{label}: not checked</Badge>;
  return <Badge tone={ok ? "good" : "bad"}>{`${label}: ${ok ? "pass" : "fail"}`}</Badge>;
}

/** Studio "Tests" tab: what each test expects, its last result, and running them on the draft. */
export function TestsPanel({
  agentId,
  canEdit,
  data,
}: {
  agentId: string;
  canEdit: boolean;
  data: Data;
}) {
  const hidden = (
    <>
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="tab" value="tests" />
    </>
  );
  const active = data.tests.filter((t) => t.test.active);
  const batch = data.lastBatch;
  return (
    <div className="space-y-5">
      <p className="text-ink-muted">
        Each test is a short scripted conversation. It checks three things separately: what the
        agent <strong>does</strong>, whether it <strong>passes to a person</strong>, and what it{" "}
        <strong>says</strong>. Tests run on your draft, nothing is booked or sent, and required
        tests must pass before you can publish.
      </p>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {batch
              ? `Last run ${when(batch.createdAt)}: ${batch.passed} of ${batch.total} passed`
              : "Tests haven't run yet"}
          </p>
          {batch && batch.requiredFailed > 0 && (
            <p className="text-sm text-node-output">
              {batch.requiredFailed} required test{batch.requiredFailed === 1 ? "" : "s"} failed:
              publishing is blocked.
            </p>
          )}
        </div>
        {canEdit && active.length > 0 && (
          <form action={runTestsAction}>
            {hidden}
            <button type="submit" className={primary}>
              Run {active.length} test{active.length === 1 ? "" : "s"} on the draft
            </button>
          </form>
        )}
      </Card>

      {data.tests.length === 0 ? (
        <Empty>No tests yet. Adding a procedure adds a starter test automatically.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.tests.map(({ test, last }) => (
            <li key={test.id}>
              <Card className={`space-y-2 ${test.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {test.name}{" "}
                    {test.required ? <Badge tone="warn">required</Badge> : <Badge>optional</Badge>}{" "}
                    {!test.active && <Badge>off</Badge>}
                  </p>
                  {last && (
                    <span className="flex flex-wrap gap-1">
                      <Check label="Does" ok={last.actionOk} />
                      <Check label="Hand-off" ok={last.handoffOk} />
                      <Check label="Says" ok={last.replyOk} />
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-muted">
                  Customer says: {test.turns.map((t) => `"${t}"`).join(" → ")}
                </p>
                <p className="text-sm">
                  Expect: {ACTION_LABELS[test.expectedAction ?? ""] ?? "any action"}
                  {test.expectedHandoff === null
                    ? ""
                    : test.expectedHandoff
                      ? ", passes to a person"
                      : ", no hand-off"}
                  . {test.expectation}
                </p>
                {last && !last.passed && last.notes && (
                  <p className="text-sm text-node-output">{last.notes}</p>
                )}
                {last &&
                  Array.isArray(last.transcript) &&
                  (last.transcript as unknown[]).length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-ink-muted">
                        Conversation from the last run
                      </summary>
                      <ol className="mt-2 space-y-1">
                        {(last.transcript as { role: string; text: string }[]).map((m, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: transcript lines are fixed
                          <li key={i}>
                            <strong>{m.role === "customer" ? "Customer" : "Agent"}:</strong>{" "}
                            {m.text}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                {canEdit && (
                  <form action={testActiveAction}>
                    {hidden}
                    <input type="hidden" name="testId" value={test.id} />
                    <input type="hidden" name="active" value={test.active ? "0" : "1"} />
                    <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                      {test.active ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          action={saveTestAction}
          className="space-y-3 rounded-2xl border border-line bg-paper-raised/60 p-5"
        >
          {hidden}
          <h2 className="font-display text-xl font-semibold">Add a test</h2>
          <label className="block">
            <span className="text-sm font-semibold">Name</span>
            <input
              name="name"
              required
              maxLength={120}
              className={input}
              placeholder="e.g. Saturday booking"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">
              What the customer says (one message per line)
            </span>
            <textarea
              name="turns"
              required
              rows={4}
              className={input}
              placeholder={"Can I come in on Saturday?\nTest Customer, 555 0100\nYes"}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">The agent should do</span>
              <select name="expectedAction" className={input} defaultValue="">
                <option value="">Don't check</option>
                {EXPECTED_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a] ?? a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Pass to a person?</span>
              <select name="expectedHandoff" className={input} defaultValue="">
                <option value="">Don't check</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold">
              What a good reply looks like (plain English)
            </span>
            <textarea
              name="expectation"
              required
              minLength={3}
              maxLength={1000}
              rows={2}
              className={input}
              placeholder="e.g. Offers a Saturday slot before 13:00 and never promises it's booked."
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" defaultChecked /> Required to publish
          </label>
          <div>
            <button type="submit" className={secondary}>
              Add test
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
