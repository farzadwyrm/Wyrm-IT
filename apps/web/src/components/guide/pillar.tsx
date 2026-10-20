import { type Area, PHASES, type Phase, PILLARS, type Pillar } from "@wyrm/guide";
import Link from "next/link";

/** Full class names per pillar (Tailwind only sees literal class names). */
export const PILLAR_STYLE: Record<Pillar, { text: string; border: string }> = {
  foundation: { text: "text-pillar-foundation", border: "border-l-pillar-foundation" },
  identity: { text: "text-pillar-identity", border: "border-l-pillar-identity" },
  devices: { text: "text-pillar-devices", border: "border-l-pillar-devices" },
  network: { text: "text-pillar-network", border: "border-l-pillar-network" },
  applications: { text: "text-pillar-applications", border: "border-l-pillar-applications" },
  data: { text: "text-pillar-data", border: "border-l-pillar-data" },
  visibility: { text: "text-pillar-visibility", border: "border-l-pillar-visibility" },
};

const ICON_PATHS: Record<Pillar, string> = {
  // building
  foundation:
    "M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01",
  // key
  identity: "M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7Zm1 2h.01",
  // laptop
  devices: "M5 5h14v10H5zM2 19h20",
  // connected nodes
  network:
    "M12 5a2 2 0 1 0 0-.01M5 19a2 2 0 1 0 0-.01M19 19a2 2 0 1 0 0-.01M12 7v5M12 12l-6 5M12 12l6 5",
  // app grid
  applications: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  // database
  data: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  // eye
  visibility: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
};

export function PillarIcon({
  pillar,
  className = "size-5",
}: {
  pillar: Pillar;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICON_PATHS[pillar]} />
    </svg>
  );
}

export function PillarTag({ pillar }: { pillar: Pillar }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${PILLAR_STYLE[pillar].text}`}
    >
      <PillarIcon pillar={pillar} className="size-4" />
      {PILLARS[pillar].name}
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  const urgent = phase === 1;
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        urgent ? "border-ember/40 bg-ember/10 text-ember" : "border-line text-ink-muted"
      }`}
    >
      {phase} · {PHASES[phase].name}
    </span>
  );
}

export function AreaCard({ area }: { area: Area }) {
  return (
    <Link
      href={`/guide/${area.slug}`}
      className={`group flex h-full flex-col rounded-2xl border border-l-4 border-line bg-paper-raised p-5 transition-colors hover:border-ink-muted ${PILLAR_STYLE[area.pillar].border}`}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <PillarTag pillar={area.pillar} />
        <PhaseBadge phase={area.phase} />
      </span>
      <span className="mt-3 font-semibold group-hover:text-ember">{area.title}</span>
      <span className="mt-1.5 flex-1 text-sm text-ink-muted">{area.oneLiner}</span>
      {area.specialist && (
        <span className="mt-3 text-xs text-ink-muted">Mainly for engineering and lab teams</span>
      )}
    </Link>
  );
}
