-- Wyrm portal v4: Agent Studio. What a customer controls about each agent, as separate objects
-- (research: docs/research/agent-policies.md; plan: docs/plans/agent-studio-roadmap.md).
--
--   business_profiles  facts only (hours, services and prices, locations, FAQs), per tenant
--   agent_rules        short plain-language rules with a scope and priority (max 15 per agent)
--   agent_procedures   step-by-step playbooks from templates: when to use, required info, action
--   agent_limits       hard limits checked in code before any action, plus handoff and voice
--   policy_changes     append-only change log; every change needs a "what changed" note
--
-- Studio edits are the draft. Publishing snapshots them into agent_settings_versions (0003), and the
-- live agent uses the published snapshot. Same security model: read-only for signed-in users,
-- every write through the server after the permission check.

-- 1. Facts.
create table public.business_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (octet_length(profile::text) <= 60000)
);

-- 2. Rules.
create table public.agent_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  text text not null check (char_length(text) between 5 and 300),
  -- {"channels": [], "when": "any|open|closed", "callers": "any|new|returning"}
  scope jsonb not null default '{}'::jsonb,
  priority smallint not null default 0 check (priority between -10 and 10),
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_rules_agent_idx on public.agent_rules (agent_id);

-- 3. Procedures.
create table public.agent_procedures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  template text not null check (template in ('book', 'reschedule', 'cancel', 'message', 'transfer', 'quote')),
  name text not null check (char_length(name) between 2 and 80),
  when_to_use text not null check (char_length(when_to_use) between 5 and 512),
  when_not_to_use text not null default '' check (char_length(when_not_to_use) <= 512),
  -- [{"key": "name", "label": "Full name", "type": "text|phone|email|date|time|choice", "options": []}]
  required_info jsonb not null default '[]'::jsonb check (jsonb_typeof(required_info) = 'array'),
  steps text[] not null default '{}' check (cardinality(steps) <= 12),
  confirm_before_acting boolean not null default true,
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, template)
);

-- 4. Limits, handoff and voice (one row per agent).
create table public.agent_limits (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  max_discount_percent smallint not null default 0 check (max_discount_percent between 0 and 100),
  booking_window_days smallint not null default 30 check (booking_window_days between 0 and 365),
  min_notice_hours smallint not null default 2 check (min_notice_hours between 0 and 168),
  cancellation_notice_hours smallint not null default 24 check (cancellation_notice_hours between 0 and 336),
  after_hours text not null default 'take_message' check (after_hours in ('answer', 'take_message', 'handoff')),
  blocked_topics text[] not null default '{}' check (cardinality(blocked_topics) <= 20),
  handoff_contact text not null default '' check (char_length(handoff_contact) <= 200),
  handoff_when text[] not null default '{asked,frustrated,loop}' check (cardinality(handoff_when) <= 10),
  tone text not null default 'friendly' check (tone in ('friendly', 'formal', 'brief')),
  reply_length text not null default 'short' check (reply_length in ('short', 'medium')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 5. Change log.
create table public.policy_changes (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  object_type text not null check (object_type in ('profile', 'rule', 'procedure', 'limits', 'publish', 'restore')),
  object_id text,
  action text not null check (action in ('create', 'update', 'delete', 'enable', 'disable', 'publish', 'restore')),
  note text not null check (char_length(btrim(note)) between 3 and 500),
  before jsonb,
  after jsonb,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index policy_changes_agent_idx on public.policy_changes (tenant_id, agent_id, created_at desc);

-- 6. Hard rules.
create function public.enforce_policy_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.agents where id = new.agent_id and tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch';
  end if;
  if tg_table_name = 'agent_rules' and tg_op = 'INSERT'
     and (select count(*) from public.agent_rules where agent_id = new.agent_id) >= 15 then
    raise exception 'rule_limit';
  end if;
  if tg_table_name in ('agent_rules', 'agent_procedures') then
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger agent_rules_policy before insert or update on public.agent_rules
  for each row execute function public.enforce_policy_rules();
create trigger agent_procedures_policy before insert or update on public.agent_procedures
  for each row execute function public.enforce_policy_rules();
create trigger agent_limits_policy before insert or update on public.agent_limits
  for each row execute function public.enforce_policy_rules();

create function public.enforce_change_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.agent_id is not null
     and not exists (select 1 from public.agents where id = new.agent_id and tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch';
  end if;
  return new;
end $$;
create trigger policy_changes_tenant before insert on public.policy_changes
  for each row execute function public.enforce_change_tenant();
create trigger policy_changes_append_only before update or delete on public.policy_changes
  for each row execute function public.forbid_update();

-- 7. Row-level security: anyone who can see the agent can read its policy; facts for any member.
alter table public.business_profiles enable row level security;
alter table public.agent_rules enable row level security;
alter table public.agent_procedures enable row level security;
alter table public.agent_limits enable row level security;
alter table public.policy_changes enable row level security;

create policy business_profiles_read on public.business_profiles for select to authenticated
  using (public.platform_role() is not null or public.my_tenant_user(tenant_id) is not null);
create policy agent_rules_read on public.agent_rules for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy agent_procedures_read on public.agent_procedures for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy agent_limits_read on public.agent_limits for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy policy_changes_read on public.policy_changes for select to authenticated
  using (public.platform_role() is not null
         or (agent_id is not null and public.can_see_agent(agent_id, tenant_id))
         or (agent_id is null and public.my_tenant_user(tenant_id) is not null));

grant select on public.business_profiles, public.agent_rules, public.agent_procedures,
  public.agent_limits, public.policy_changes to authenticated;
grant select, insert, update, delete on public.business_profiles, public.agent_rules,
  public.agent_procedures, public.agent_limits, public.policy_changes to service_role;
grant usage, select on all sequences in schema public to service_role;

-- 8. Conversation state for procedures (which playbook is running and what's collected).
alter table public.conversations add column state jsonb not null default '{}'::jsonb;
