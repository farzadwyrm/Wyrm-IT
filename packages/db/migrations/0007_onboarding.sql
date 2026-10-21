-- Wyrm portal v6: onboarding and delivery (docs/plans/agent-studio-roadmap.md, phase 3).
--
--   agent_channels       website chat widget settings per agent (allowed sites, colour, button text)
--   calendar_connections Google Calendar link per agent; the refresh token is stored encrypted by the
--                        server (AES-256-GCM), never readable by signed-in users
--   profile_suggestions  facts drafted from the business's website, waiting for the owner to confirm
--   agent_launches       go-live sign-off by Wyrm staff and the rollout stage
--
-- Same model as before: signed-in users read (except token ciphertext), the server writes.

create table public.agent_channels (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  widget_enabled boolean not null default false,
  -- Sites allowed to show the widget, e.g. {"https://brightsmile.example"}; empty = any site.
  widget_origins text[] not null default '{}' check (cardinality(widget_origins) <= 10),
  widget_color text not null default '#e8590c' check (widget_color ~ '^#[0-9a-fA-F]{6}$'),
  widget_label text not null default 'Chat with us' check (char_length(widget_label) between 2 and 40),
  updated_at timestamptz not null default now()
);

create table public.calendar_connections (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  account_email text check (char_length(account_email) <= 200),
  calendar_id text not null default 'primary' check (char_length(calendar_id) <= 300),
  refresh_token_enc text not null, -- base64(iv | tag | ciphertext); key held only by the server
  scopes text not null default '',
  status text not null default 'ok' check (status in ('ok', 'error', 'revoked')),
  last_checked_at timestamptz,
  last_error text check (char_length(last_error) <= 300),
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now()
);

create table public.profile_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source_url text not null check (char_length(source_url) <= 500),
  pages_read int not null default 0 check (pages_read between 0 and 50),
  draft jsonb not null default '{}'::jsonb check (octet_length(draft::text) <= 60000),
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index profile_suggestions_tenant_idx on public.profile_suggestions (tenant_id, created_at desc);

create table public.agent_launches (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  signed_off_by uuid references auth.users (id) on delete set null,
  signed_off_at timestamptz,
  note text check (char_length(note) <= 500),
  -- Phone rollout (call forwarding): after hours first, then overflow, then every call.
  stage text not null default 'not_started' check (stage in ('not_started', 'after_hours', 'overflow', 'all'))
);

create trigger agent_channels_tenant before insert or update on public.agent_channels
  for each row execute function public.enforce_ops_tenant();
create trigger calendar_connections_tenant before insert or update on public.calendar_connections
  for each row execute function public.enforce_ops_tenant();
create trigger agent_launches_tenant before insert or update on public.agent_launches
  for each row execute function public.enforce_ops_tenant();

alter table public.agent_channels enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.profile_suggestions enable row level security;
alter table public.agent_launches enable row level security;

create policy agent_channels_read on public.agent_channels for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy calendar_connections_read on public.calendar_connections for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy profile_suggestions_read on public.profile_suggestions for select to authenticated
  using (public.platform_role() is not null or public.my_tenant_user(tenant_id) is not null);
create policy agent_launches_read on public.agent_launches for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

-- Signed-in users may read connection details but never the encrypted token column.
grant select on public.agent_channels, public.profile_suggestions, public.agent_launches to authenticated;
grant select (agent_id, tenant_id, provider, account_email, calendar_id, scopes, status,
  last_checked_at, last_error, connected_by, connected_at) on public.calendar_connections to authenticated;
grant select, insert, update, delete on public.agent_channels, public.calendar_connections,
  public.profile_suggestions, public.agent_launches to service_role;
