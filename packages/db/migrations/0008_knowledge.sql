-- Wyrm portal v7: "Ask your documents" (the knowledge agent).
--
--   knowledge_sources    a document, web page, Google Drive file or pasted text added to one agent
--   knowledge_chunks     the source's text cut into passages, with a keyword index for search
--   knowledge_questions  every question staff asked, the answer, the passages it cited and feedback
--
-- Access follows the agent: whoever may use an agent may ask it; whoever configures it manages its
-- documents. Keep sensitive documents in their own agent and share that agent only with the right
-- people. Signed-in users may read the list of sources; passage text and questions are read and
-- written only by the server (which checks permissions in @wyrm/core).

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  kind text not null check (kind in ('upload', 'website', 'google_drive', 'text')),
  name text not null check (char_length(name) between 1 and 200),
  -- Web address, or the Drive file id for google_drive; null for uploads and pasted text.
  location text check (char_length(location) <= 500),
  mime text check (char_length(mime) <= 120),
  status text not null default 'ready' check (status in ('ready', 'error')),
  error text check (char_length(error) <= 300),
  chars int not null default 0 check (chars >= 0),
  chunk_count int not null default 0 check (chunk_count >= 0),
  content_hash text check (char_length(content_hash) <= 64),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_sources_agent_idx on public.knowledge_sources (agent_id, created_at desc);
create unique index knowledge_sources_location_idx on public.knowledge_sources (agent_id, kind, location)
  where location is not null;

create table public.knowledge_chunks (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  position int not null check (position >= 0),
  heading text check (char_length(heading) <= 300),
  content text not null check (char_length(content) between 1 and 4000),
  -- 'simple' keeps every language searchable (no stemming); the model widens the search words.
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B')
  ) stored
);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin (search);
create index knowledge_chunks_source_idx on public.knowledge_chunks (source_id, position);
create index knowledge_chunks_agent_idx on public.knowledge_chunks (agent_id);

create table public.knowledge_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  asked_by uuid references auth.users (id) on delete set null,
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null default '' check (char_length(answer) <= 4000),
  answered boolean not null default false,
  -- [{ "sourceId", "name", "chunkId" }] in citation order.
  citations jsonb not null default '[]'::jsonb check (octet_length(citations::text) <= 8000),
  feedback text check (feedback in ('up', 'down')),
  provider text check (char_length(provider) <= 40),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  created_at timestamptz not null default now()
);
create index knowledge_questions_agent_idx on public.knowledge_questions (agent_id, created_at desc);

create trigger knowledge_sources_tenant before insert or update on public.knowledge_sources
  for each row execute function public.enforce_ops_tenant();
create trigger knowledge_chunks_tenant before insert or update on public.knowledge_chunks
  for each row execute function public.enforce_ops_tenant();
create trigger knowledge_questions_tenant before insert or update on public.knowledge_questions
  for each row execute function public.enforce_ops_tenant();

-- A passage must belong to a source of the same agent (and so the same organisation).
create function public.enforce_chunk_source() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.knowledge_sources s
                 where s.id = new.source_id and s.agent_id = new.agent_id and s.tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch';
  end if;
  return new;
end $$;
create trigger knowledge_chunks_source before insert or update on public.knowledge_chunks
  for each row execute function public.enforce_chunk_source();

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_questions enable row level security;

create policy knowledge_sources_read on public.knowledge_sources for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

grant select on public.knowledge_sources to authenticated;
grant select, insert, update, delete on public.knowledge_sources, public.knowledge_chunks,
  public.knowledge_questions to service_role;
