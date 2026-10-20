import { DEMO_PROFILE, getProfile, hoursText, PROFILES } from "@wyrm/receptionist";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceptionistDemo } from "@/components/receptionist/receptionist-demo";
import { Container, CtaBand, PageHeader } from "@/components/sections";

// One page per client settings file; anything else is a 404. The demo clinic lives at /receptionist.
export const dynamicParams = false;

export function generateStaticParams() {
  return PROFILES.filter((p) => p.id !== DEMO_PROFILE.id).map((p) => ({ client: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/receptionist/[client]">): Promise<Metadata> {
  const profile = getProfile((await params).client);
  if (!profile) return {};
  return {
    title: `${profile.name} receptionist`,
    description: `Chat with or call the AI receptionist for ${profile.name}, ${profile.kind}.`,
    ...(profile.demo ? {} : { robots: { index: false } }),
  };
}

export default async function ClientReceptionistPage({
  params,
}: PageProps<"/receptionist/[client]">) {
  const profile = getProfile((await params).client);
  if (!profile || profile.id === DEMO_PROFILE.id) notFound();

  return (
    <>
      <PageHeader
        eyebrow={profile.demo ? "template example · voice agent" : "receptionist"}
        title={`${profile.name} receptionist`}
        intro={`The same receptionist agent, set up for ${profile.kind} from one settings file.${profile.demo ? " A fictional business: nothing is really booked." : ""}`}
      />
      <Container className="grid gap-10 pb-16 lg:grid-cols-[3fr_2fr]">
        <ReceptionistDemo profileId={profile.id} />
        <aside className="space-y-6 text-sm">
          <div className="rounded-2xl border border-line bg-paper-raised/80 p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-signal">
              from the settings file
            </p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-ink-muted">Opening hours</dt>
                <dd>{hoursText(profile)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Services</dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {profile.services.map((s) => (
                      <li key={s.id}>
                        {s.name} · {s.minutes} min · {s.price}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Address</dt>
                <dd>{profile.address}</dd>
              </div>
              {profile.facts.length > 0 && (
                <div>
                  <dt className="text-ink-muted">Good to know</dt>
                  <dd>
                    <ul className="mt-1 space-y-1">
                      {profile.facts.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </Container>
      {profile.demo && <CtaBand />}
    </>
  );
}
