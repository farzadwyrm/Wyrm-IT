-- Wyrm portal v2: two-tier user management.
--   Platform level: Wyrm staff (platform_users) with super_admin | platform_admin | support | billing.
--   Tenant level:   customer organisations (tenants) and their staff (tenant_users) with roles.
-- Replaces the P0 tables (organizations, memberships, agents, profile_versions, audit_log,
-- wyrm_admins). Existing Wyrm admins become super admins.
--
-- Security model:
--   * Signed-in users only READ through the API, under row-level security (RLS).
--   * Every write goes through the portal server (secret key) after a central permission check
--     (packages/auth `can()`); the database still enforces hard rules with constraints and
--     triggers: identity separation, exactly one owner, seat and agent limits.
--   * Suspended tenants: their users see nothing.

-- 1. Carry over existing Wyrm admins, then remove the P0 tables.
create table public.platform_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  platform_role text not null check (platform_role in ('super_admin', 'platform_admin', 'support', 'billing')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

insert into public.platform_users (id, email, platform_role)
select a.user_id, u.email, 'super_admin'
from public.wyrm_admins a join auth.users u on u.id = a.user_id
where u.email is not null;

drop table if exists public.profile_versions, public.agents, public.memberships,
  public.audit_log, public.organizations, public.wyrm_admins cascade;
drop function if exists public.is_wyrm_admin(), public.has_org_role(uuid, text[]);

-- 2. Tenants and their staff.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'pilot' check (plan in ('pilot', 'starter', 'growth', 'enterprise')),
  seat_limit int not null default 5 check (seat_limit between 1 and 10000),
  agent_limit int not null default 1 check (agent_limit between 0 and 1000),
  status text not null default 'active' check (status in ('active', 'suspended')),
  features jsonb not null default '{}'::jsonb,
  -- require_mfa (bool), allowed_domains (text[]), session_timeout_minutes (int)
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Built-in roles have tenant_id null; custom roles belong to one tenant. `rank` orders roles
-- for the no-escalation rule (owner 50 > admin 40 > manager 30 > member 20 > viewer 10).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  rank int not null check (rank between 1 and 50),
  permissions text[] not null default '{}',
  built_in boolean not null default false,
  created_at timestamptz not null default now(),
  check (built_in = (tenant_id is null)),
  check (built_in or rank < 50) -- only the built-in owner role has owner rank
);
create unique index roles_builtin_key on public.roles (key) where tenant_id is null;
create unique index roles_tenant_key on public.roles (tenant_id, key) where tenant_id is not null;

insert into public.roles (key, name, rank, built_in, permissions) values
  ('owner', 'Owner', 50, true, array[
    'staff.view','staff.invite','staff.edit','staff.deactivate','staff.remove',
    'roles.view','roles.manage','teams.view','teams.manage',
    'agents.view_all','agents.use','agents.configure','agents.logs','agents.assign',
    'security.view','security.manage','audit.view',
    'billing.view','billing.manage','ownership.transfer']),
  ('admin', 'Admin', 40, true, array[
    'staff.view','staff.invite','staff.edit','staff.deactivate','staff.remove',
    'roles.view','roles.manage','teams.view','teams.manage',
    'agents.view_all','agents.use','agents.configure','agents.logs','agents.assign',
    'security.view','security.manage','audit.view']),
  ('manager', 'Manager', 30, true, array[
    'staff.view','teams.view','teams.manage_own','agents.use','agents.logs','agents.assign_own']),
  ('member', 'Member', 20, true, array['agents.use']),
  ('viewer', 'Viewer', 10, true, array['agents.logs']);

create table public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role_id uuid not null references public.roles (id),
  is_owner boolean not null default false, -- maintained by trigger from the role
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (tenant_id, user_id),
  unique (tenant_id, email)
);
create index tenant_users_user_idx on public.tenant_users (user_id);
-- Exactly one owner per tenant (at most one here; "at least one" is enforced by the server's
-- ownership-transfer flow and the delete trigger below).
create unique index tenant_users_one_owner on public.tenant_users (tenant_id) where is_owner;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  tenant_user_id uuid not null references public.tenant_users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  is_manager boolean not null default false,
  primary key (team_id, tenant_user_id)
);

-- 3. Agents and who may use them.
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  type text not null check (type in ('receptionist', 'inbox', 'knowledge', 'sales', 'back_office',
    'support', 'quote', 'payment_reminder', 'scheduling', 'reporting', 'reviews', 'meeting')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agents_tenant_idx on public.agents (tenant_id);

create table public.agent_access (
  agent_id uuid not null references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject_type text not null check (subject_type in ('user', 'team')),
  subject_id uuid not null,
  level text not null check (level in ('use', 'configure', 'view_logs')),
  created_at timestamptz not null default now(),
  primary key (agent_id, subject_type, subject_id)
);

-- Every saved version of an agent's settings (e.g. a receptionist BusinessProfile).
create table public.agent_settings_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  settings jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- 4. Invitations, audit, impersonation.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles (id),
  token_hash text not null unique, -- SHA-256 of the emailed token; the token itself is never stored
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index invitations_one_pending on public.invitations (tenant_id, lower(email))
  where status = 'pending';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_type text not null check (actor_type in ('platform', 'tenant', 'system')),
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb, -- before/after values, impersonation session id
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references public.platform_users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tenant_user_id uuid not null references public.tenant_users (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  read_only boolean not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  ended_at timestamptz
);

-- 5. Hard rules the database enforces itself.

-- A login is either Wyrm staff or customer staff, never both.
create function public.enforce_identity_separation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'tenant_users' then
    if exists (select 1 from public.platform_users p where p.id = new.user_id or lower(p.email) = lower(new.email)) then
      raise exception 'identity_separation: Wyrm staff cannot join a customer organisation';
    end if;
  else
    if exists (select 1 from public.tenant_users t where t.user_id = new.id or lower(t.email) = lower(new.email)) then
      raise exception 'identity_separation: customer staff cannot be Wyrm staff';
    end if;
  end if;
  return new;
end $$;
create trigger tenant_users_identity before insert or update of user_id, email on public.tenant_users
  for each row execute function public.enforce_identity_separation();
create trigger platform_users_identity before insert or update of id, email on public.platform_users
  for each row execute function public.enforce_identity_separation();

-- Keep is_owner in step with the role, and only allow roles from the same tenant or built-ins.
create function public.sync_tenant_user_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.roles;
begin
  select * into r from public.roles where id = new.role_id;
  if r.tenant_id is not null and r.tenant_id <> new.tenant_id then
    raise exception 'role_scope: role belongs to another organisation';
  end if;
  new.is_owner := (r.key = 'owner' and r.built_in);
  return new;
end $$;
create trigger tenant_users_role before insert or update of role_id, tenant_id on public.tenant_users
  for each row execute function public.sync_tenant_user_role();

-- The owner can't be removed or deactivated; transfer ownership first.
create function public.protect_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_owner and exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'owner_required: transfer ownership before removing the owner';
    end if;
    return old;
  end if;
  if old.is_owner and new.status <> 'active' then
    raise exception 'owner_required: the owner cannot be deactivated';
  end if;
  return new;
end $$;
create trigger tenant_users_owner_delete before delete on public.tenant_users
  for each row execute function public.protect_owner();
create trigger tenant_users_owner_status before update of status on public.tenant_users
  for each row execute function public.protect_owner();

-- Seats: active staff plus pending invitations may not exceed the tenant's seat limit.
create function public.seats_in_use(t uuid) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.tenant_users where tenant_id = t and status = 'active')::int
       + (select count(*) from public.invitations
          where tenant_id = t and status = 'pending' and expires_at > now())::int;
$$;

create function public.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  if (tg_table_name = 'tenant_users' and new.status = 'active'
        and (tg_op = 'INSERT' or old.status <> 'active'))
     or (tg_table_name = 'invitations' and tg_op = 'INSERT') then
    select seat_limit into lim from public.tenants where id = new.tenant_id for update;
    -- An accepted invitation turns into a seat: don't count it twice.
    if public.seats_in_use(new.tenant_id) >= lim
       and not (tg_table_name = 'tenant_users' and exists (
         select 1 from public.invitations i where i.tenant_id = new.tenant_id
           and lower(i.email) = lower(new.email) and i.status = 'pending' and i.expires_at > now())) then
      raise exception 'seat_limit: this organisation has no free seats';
    end if;
  end if;
  return new;
end $$;
create trigger tenant_users_seats before insert or update of status on public.tenant_users
  for each row execute function public.enforce_seat_limit();
create trigger invitations_seats before insert on public.invitations
  for each row execute function public.enforce_seat_limit();

create function public.enforce_agent_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  select agent_limit into lim from public.tenants where id = new.tenant_id for update;
  if (select count(*) from public.agents where tenant_id = new.tenant_id) >= lim then
    raise exception 'agent_limit: this organisation has reached its agent limit';
  end if;
  return new;
end $$;
create trigger agents_limit before insert on public.agents
  for each row execute function public.enforce_agent_limit();

-- Same-tenant integrity for rows that point at other rows.
create function public.enforce_same_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'team_members' then
    if not exists (select 1 from public.teams where id = new.team_id and tenant_id = new.tenant_id)
       or not exists (select 1 from public.tenant_users where id = new.tenant_user_id and tenant_id = new.tenant_id) then
      raise exception 'tenant_mismatch';
    end if;
  elsif tg_table_name = 'agent_access' then
    if not exists (select 1 from public.agents where id = new.agent_id and tenant_id = new.tenant_id)
       or (new.subject_type = 'user' and not exists (select 1 from public.tenant_users where id = new.subject_id and tenant_id = new.tenant_id))
       or (new.subject_type = 'team' and not exists (select 1 from public.teams where id = new.subject_id and tenant_id = new.tenant_id)) then
      raise exception 'tenant_mismatch';
    end if;
  elsif tg_table_name = 'agent_settings_versions' then
    if not exists (select 1 from public.agents where id = new.agent_id and tenant_id = new.tenant_id) then
      raise exception 'tenant_mismatch';
    end if;
  elsif tg_table_name = 'impersonation_sessions' then
    if not exists (select 1 from public.tenant_users where id = new.tenant_user_id and tenant_id = new.tenant_id) then
      raise exception 'tenant_mismatch';
    end if;
  end if;
  return new;
end $$;
create trigger team_members_tenant before insert or update on public.team_members
  for each row execute function public.enforce_same_tenant();
create trigger agent_access_tenant before insert or update on public.agent_access
  for each row execute function public.enforce_same_tenant();
create trigger agent_settings_tenant before insert or update on public.agent_settings_versions
  for each row execute function public.enforce_same_tenant();
create trigger impersonation_tenant before insert or update on public.impersonation_sessions
  for each row execute function public.enforce_same_tenant();

-- Pausing: a suspended tenant's agents go to 'paused' (data kept).
create function public.pause_agents_on_suspend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'suspended' and old.status <> 'suspended' then
    update public.agents set status = 'paused' where tenant_id = new.id and status = 'live';
  end if;
  return new;
end $$;
create trigger tenants_suspend after update of status on public.tenants
  for each row execute function public.pause_agents_on_suspend();

-- 6. Helpers for row-level security (SECURITY DEFINER so policies don't recurse).
create function public.platform_role() returns text
language sql stable security definer set search_path = public as $$
  select platform_role from public.platform_users where id = auth.uid() and status = 'active';
$$;

-- The signed-in user's active membership in a tenant (null if none, deactivated or suspended).
create function public.my_tenant_user(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select tu.id from public.tenant_users tu join public.tenants tn on tn.id = tu.tenant_id
  where tu.tenant_id = t and tu.user_id = auth.uid() and tu.status = 'active' and tn.status = 'active';
$$;

create function public.has_tenant_permission(t uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_users tu
    join public.tenants tn on tn.id = tu.tenant_id
    join public.roles r on r.id = tu.role_id
    where tu.tenant_id = t and tu.user_id = auth.uid() and tu.status = 'active'
      and tn.status = 'active' and perm = any (r.permissions)
  );
$$;

-- Agents a tenant user can see: all (agents.view_all) or those granted to them or their teams.
create function public.can_see_agent(a uuid, t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_tenant_permission(t, 'agents.view_all') or exists (
    select 1 from public.agent_access aa
    where aa.agent_id = a and (
      (aa.subject_type = 'user' and aa.subject_id = public.my_tenant_user(t))
      or (aa.subject_type = 'team' and aa.subject_id in (
        select tm.team_id from public.team_members tm where tm.tenant_user_id = public.my_tenant_user(t)))
    )
  );
$$;

-- Finds an existing account by email (to link a new owner). Server only.
create or replace function public.user_id_by_email(email_address text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(email_address) limit 1;
$$;

-- 7. Row-level security: read-only access for signed-in users.
alter table public.platform_users enable row level security;
alter table public.tenants enable row level security;
alter table public.roles enable row level security;
alter table public.tenant_users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_access enable row level security;
alter table public.agent_settings_versions enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.impersonation_sessions enable row level security;

create policy platform_users_read on public.platform_users for select to authenticated
  using (public.platform_role() is not null);

create policy tenants_read on public.tenants for select to authenticated
  using (public.platform_role() is not null or public.my_tenant_user(id) is not null);

create policy roles_read on public.roles for select to authenticated
  using (tenant_id is null or public.platform_role() is not null
         or public.my_tenant_user(tenant_id) is not null);

create policy tenant_users_read on public.tenant_users for select to authenticated
  using (public.platform_role() is not null
         or (user_id = auth.uid() and public.my_tenant_user(tenant_id) is not null)
         or public.has_tenant_permission(tenant_id, 'staff.view'));

create policy teams_read on public.teams for select to authenticated
  using (public.platform_role() is not null or public.has_tenant_permission(tenant_id, 'teams.view')
         or exists (select 1 from public.team_members tm
                    where tm.team_id = teams.id
                      and tm.tenant_user_id = public.my_tenant_user(teams.tenant_id)));

create policy team_members_read on public.team_members for select to authenticated
  using (public.platform_role() is not null or public.has_tenant_permission(tenant_id, 'teams.view')
         or tenant_user_id = public.my_tenant_user(tenant_id));

create policy agents_read on public.agents for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(id, tenant_id));

create policy agent_access_read on public.agent_access for select to authenticated
  using (public.platform_role() is not null
         or public.has_tenant_permission(tenant_id, 'agents.view_all')
         or public.can_see_agent(agent_id, tenant_id));

create policy agent_settings_read on public.agent_settings_versions for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

create policy invitations_read on public.invitations for select to authenticated
  using (public.platform_role() is not null or public.has_tenant_permission(tenant_id, 'staff.invite'));

create policy audit_read on public.audit_logs for select to authenticated
  using (public.platform_role() in ('super_admin', 'platform_admin', 'support')
         or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'audit.view')));

-- Tenant owners/admins see Wyrm "view as" sessions on their organisation.
create policy impersonation_read on public.impersonation_sessions for select to authenticated
  using (public.platform_role() in ('super_admin', 'platform_admin', 'support')
         or public.has_tenant_permission(tenant_id, 'audit.view'));

-- 8. Privileges: signed-in users read only; the server's secret key does all writes.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select on public.platform_users, public.tenants, public.roles, public.tenant_users,
  public.teams, public.team_members, public.agents, public.agent_access,
  public.agent_settings_versions, public.invitations, public.audit_logs,
  public.impersonation_sessions to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
grant execute on function public.platform_role(), public.my_tenant_user(uuid),
  public.has_tenant_permission(uuid, text), public.can_see_agent(uuid, uuid),
  public.seats_in_use(uuid) to authenticated, service_role;
