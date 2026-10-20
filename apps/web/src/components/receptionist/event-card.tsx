import type { ToolEvent } from "@wyrm/ai";
import { formatDay, formatTime, SERVICES, type Service } from "@wyrm/receptionist";

/** Card under a receptionist message: a proposal waiting for a yes, or a booking change. */
export function EventCard({
  event,
  services = SERVICES,
  demo = true,
}: {
  event: ToolEvent;
  services?: readonly Service[];
  demo?: boolean;
}) {
  const slot = event.type === "proposed" ? event.proposal : event.booking;
  const service = services.find((s) => s.id === slot.serviceId);
  const details = `${service?.name ?? "Visit"} · ${formatDay(slot.day)} · ${formatTime(slot.time)}`;

  if (event.type === "proposed") {
    return (
      <div className="mt-2 rounded-2xl border border-dashed border-ember p-4 text-sm">
        <p className="font-semibold text-ember">Waiting for your confirmation</p>
        <p className="mt-1">{details}</p>
        <p className="text-ink-muted">{slot.name}</p>
      </div>
    );
  }

  const cancelled = event.type === "cancelled";
  return (
    <div
      className={`mt-2 rounded-2xl border p-4 text-sm ${cancelled ? "border-line opacity-70" : "border-moss"}`}
    >
      <p className={`font-semibold ${cancelled ? "line-through" : "text-moss"}`}>
        {cancelled
          ? "Appointment cancelled"
          : demo
            ? "Appointment booked (demo)"
            : "Appointment booked"}
      </p>
      <p className="mt-1">{details}</p>
      <p className="text-ink-muted">
        {slot.name} · ref {event.booking.reference}
      </p>
    </div>
  );
}

export const eventKey = (event: ToolEvent) =>
  `${event.type}-${event.type === "proposed" ? event.proposal.id : event.booking.reference}`;
