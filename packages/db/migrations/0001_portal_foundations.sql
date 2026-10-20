-- Wyrm portal, phase P0: organisations, members, agents, settings versions, audit log.
-- Run once in the Supabase SQL editor (or with `psql`). Requires Supabase's `auth` schema.
-- Tenant isolation is enforced by row-level security: every client row carries org_id and
-- every table has policies. The server's secret key (service_role) bypasses RLS and is used
-- only for admin actions such as inviting users.

-- Wyrm staff with access to every client.
create table public.wyrm_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'pilot' check (plan in ('pilot', 'standard', 'custom')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type in ('receptionist')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  created_at timestamptz not null default now()
);
create index agents_org_idx on public.agents (org_id);

-- Every saved version of an agent's settings (a BusinessProfile as JSON). Never edited in place.
create table public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index profile_versions_agent_idx on public.profile_versions (agent_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (org_id, at desc);

-- Helpers used by the policies. SECURITY DEFINER so policies don't recurse into memberships' RLS.
create function public.is_wyrm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wyrm_admins where user_id = auth.uid());
$$;

create function public.has_org_role(target_org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where org_id = target_org and user_id = auth.uid() and role = any (roles)
  );
$$;

-- Finds an existing account by email (to link a new business to a known owner). Server only.
create function public.user_id_by_email(email_address text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(email_address) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

alter table public.wyrm_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.agents enable row level security;
alter table public.profile_versions enable row level security;
alter table public.audit_log enable row level security;

-- wyrm_admins: admins can see the list; changes only with the secret key.
create policy admins_read on public.wyrm_admins for select to authenticated
  using (public.is_wyrm_admin());

-- organizations: members see their own; admins see and manage all.
create policy orgs_read on public.organizations for select to authenticated
  using (public.has_org_role(id, array['owner', 'staff']) or public.is_wyrm_admin());
create policy orgs_admin_write on public.organizations for all to authenticated
  using (public.is_wyrm_admin()) with check (public.is_wyrm_admin());

-- memberships: see your own row and your organisation's team; owners manage staff; admins all.
create policy members_read on public.memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_role(org_id, array['owner'])
    or public.is_wyrm_admin()
  );
create policy members_owner_adds_staff on public.memberships for insert to authenticated
  with check (role = 'staff' and public.has_org_role(org_id, array['owner']));
create policy members_owner_removes_staff on public.memberships for delete to authenticated
  using (role = 'staff' and public.has_org_role(org_id, array['owner']));
create policy members_admin_write on public.memberships for all to authenticated
  using (public.is_wyrm_admin()) with check (public.is_wyrm_admin());

-- agents: members read; only admins create or change agents.
create policy agents_read on public.agents for select to authenticated
  using (public.has_org_role(org_id, array['owner', 'staff']) or public.is_wyrm_admin());
create policy agents_admin_write on public.agents for all to authenticated
  using (public.is_wyrm_admin()) with check (public.is_wyrm_admin());

-- profile_versions: members read; owners and admins add new versions (never edit old ones).
create policy profiles_read on public.profile_versions for select to authenticated
  using (public.has_org_role(org_id, array['owner', 'staff']) or public.is_wyrm_admin());
create policy profiles_owner_insert on public.profile_versions for insert to authenticated
  with check (
    (public.has_org_role(org_id, array['owner']) or public.is_wyrm_admin())
    and exists (select 1 from public.agents a where a.id = agent_id and a.org_id = org_id)
  );

-- audit_log: owners read their organisation's log; admins read all; written by the server.
create policy audit_read on public.audit_log for select to authenticated
  using (public.has_org_role(org_id, array['owner']) or public.is_wyrm_admin());

-- Nothing is visible to signed-out visitors (no policies for the anon role).
