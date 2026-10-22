-- Wyrm portal v8: read-only connections from an agent to the client's own systems.
--
--   agent_connections   one connection per system: SQL database (Postgres, MySQL, SQL Server),
--                       HubSpot CRM, Microsoft SharePoint, or the client's own search API.
--                       The secret (password, token, refresh token) is encrypted by the server
--                       (AES-256-GCM) and never readable by signed-in users.
--   connection_lookups  approved, named read-only lookups the agent may run (a SELECT with
--                       parameters, or a CRM search), written and tested by the client's manager
--   connection_calls    every lookup the agent ran: who asked, parameters, rows, time, error
--
-- Read-only is enforced three times: the account is checked when connecting (writes refused),
-- only approved SELECT lookups exist, and each runs in a read-only transaction with a timeout
-- and a row limit. Managing connections needs security.manage and agents.configure (in code).

create table public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  kind text not null check (kind in ('postgres', 'mysql', 'sqlserver', 'hubspot', 'sharepoint', 'search_api')),
  name text not null check (char_length(name) between 1 and 80),
  -- Non-secret settings: host, port, database, user, URL, site id… (never a password).
  config jsonb not null default '{}'::jsonb check (octet_length(config::text) <= 4000),
  secret_enc text check (char_length(secret_enc) <= 8000),
  status text not null default 'untested' check (status in ('untested', 'ok', 'error', 'disabled')),
  -- What the read-only check found, in plain words ("Read-only user: 12 tables visible").
  check_note text check (char_length(check_note) <= 500),
  last_error text check (char_length(last_error) <= 500),
  last_checked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_connections_agent_idx on public.agent_connections (agent_id);

create table public.connection_lookups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid not null references public.agent_connections (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  -- When the agent should use it, in plain words; the model reads this to choose.
  description text not null check (char_length(description) between 10 and 300),
  -- SQL: one SELECT with :param placeholders. HubSpot: the object type (contacts, companies, deals).
  query text not null check (char_length(query) between 5 and 4000),
  -- [{ "name": "order_no", "label": "Order number", "type": "text" | "number" | "date" }]
  params jsonb not null default '[]'::jsonb check (jsonb_array_length(params) <= 5),
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, name)
);

create table public.connection_calls (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid references public.agent_connections (id) on delete set null,
  lookup_id uuid references public.connection_lookups (id) on delete set null,
  question_id uuid references public.knowledge_questions (id) on delete set null,
  asked_by uuid references auth.users (id) on delete set null,
  -- Parameter values the agent used (no results are stored).
  params jsonb not null default '{}'::jsonb check (octet_length(params::text) <= 2000),
  rows int not null default 0 check (rows >= 0),
  ms int not null default 0 check (ms >= 0),
  ok boolean not null default true,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now()
);
create index connection_calls_agent_idx on public.connection_calls (agent_id, created_at desc);

create trigger agent_connections_tenant before insert or update on public.agent_connections
  for each row execute function public.enforce_ops_tenant();
create trigger connection_lookups_tenant before insert or update on public.connection_lookups
  for each row execute function public.enforce_ops_tenant();
create trigger connection_calls_tenant before insert on public.connection_calls
  for each row execute function public.enforce_ops_tenant();

-- A lookup (and a logged call) must use a connection of the same agent.
create function public.enforce_connection_agent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.connection_id is not null and not exists (
    select 1 from public.agent_connections c
    where c.id = new.connection_id and c.agent_id = new.agent_id and c.tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch';
  end if;
  return new;
end $$;
create trigger connection_lookups_connection before insert or update on public.connection_lookups
  for each row execute function public.enforce_connection_agent();
create trigger connection_calls_connection before insert on public.connection_calls
  for each row execute function public.enforce_connection_agent();

alter table public.agent_connections enable row level security;
alter table public.connection_lookups enable row level security;
alter table public.connection_calls enable row level security;

create policy agent_connections_read on public.agent_connections for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy connection_lookups_read on public.connection_lookups for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

-- Signed-in users may read connection details but never the encrypted secret.
grant select (id, tenant_id, agent_id, kind, name, config, status, check_note, last_error,
  last_checked_at, created_by, created_at, updated_at) on public.agent_connections to authenticated;
grant select on public.connection_lookups to authenticated;
grant select, insert, update, delete on public.agent_connections, public.connection_lookups,
  public.connection_calls to service_role;
