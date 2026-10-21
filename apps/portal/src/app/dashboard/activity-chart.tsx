import type { DayActivity } from "@wyrm/core";

/** Validated on the dark surface (#0d1219): lightness band, CVD and contrast pass. */
const HANDLED = "#8b7cff";
const HANDED_OFF = "#b87a24";

const label = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Conversations per day: handled by the agent, handed to a person, and other (still open or
 * ended early). Each bar has a hover title; a hidden table gives the same numbers to screen readers.
 */
export function ActivityChart({ days }: { days: DayActivity[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((t, d) => t + d.total, 0);
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-lg font-semibold">
          Conversations, last {days.length} days
        </span>
        <span className="flex flex-wrap gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: HANDLED }} /> Handled by
            agent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: HANDED_OFF }} /> Handed to
            you
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-line" /> Other
          </span>
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          No conversations yet. Try your agent from My agent → Try &amp; test, or share your website
          chat.
        </p>
      ) : (
        <div aria-hidden="true">
          <div className="flex h-36 items-end gap-1 border-b border-line">
            {days.map((d) => {
              const other = Math.max(0, d.total - d.handled - d.handedOff);
              const seg = (n: number) => `${(n / max) * 100}%`;
              return (
                <div
                  key={d.day}
                  title={`${label(d.day)}: ${d.total} conversation${d.total === 1 ? "" : "s"} · ${d.handled} handled · ${d.handedOff} handed to you`}
                  className="group flex h-full flex-1 cursor-default flex-col justify-end gap-[2px] rounded-t hover:bg-paper-raised/60"
                >
                  {other > 0 && (
                    <span className="rounded-t bg-line" style={{ height: seg(other) }} />
                  )}
                  {d.handedOff > 0 && (
                    <span
                      className={other ? "" : "rounded-t"}
                      style={{ height: seg(d.handedOff), background: HANDED_OFF }}
                    />
                  )}
                  {d.handled > 0 && (
                    <span
                      className={other || d.handedOff ? "" : "rounded-t"}
                      style={{ height: seg(d.handled), background: HANDLED }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
            <span>{label(days[0]?.day ?? "")}</span>
            <span>Today</span>
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Conversations per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Total</th>
            <th scope="col">Handled by agent</th>
            <th scope="col">Handed to you</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{label(d.day)}</th>
              <td>{d.total}</td>
              <td>{d.handled}</td>
              <td>{d.handedOff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
