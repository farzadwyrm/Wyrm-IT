-- Wyrm portal v3: agent operations for the smart customer portal and the "main brain".
-- Plan: docs/plans/smart-customer-portal.md. Research: docs/research/main-brain-orchestration.md.
--
--   conversations / conversation_messages  every call, chat or message an agent handled
--   agent_decisions                        one row per brain decision (append-only, no raw personal data)
--   approvals                              risky actions held for a person (single use, expiring)
--   corrections                            "fix this answer" lessons
--   agent_tests / agent_test_runs          test questions and their results per settings version
--   usage_daily                            AI usage and cost per tenant, agent and day
--   kill_switches                          off switches: global, tenant, agent, tool, provider
--
-- Same security model as 0003: signed-in users only read (row-level security); every write goes
-- through the server after the central permission check; the database enforces hard rules.

-- 1. Budget and retention per organisation.
alter table public.tenants
  add column ai_monthly_budget_micros bigint not null default 2000000
    check (ai_monthly_budget_micros >= 0), -- USD millionths; 2000000 = $2.00
  add column retention_days int not null default 180 check (retention_days between 7 and 730);

-- 2. Conversations and their messages.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  config_version_id uuid references public.agent_settings_versions (id) on delete set null,
  channel text not null check (channel in ('voice', 'web_chat', 'sms', 'email', 'whatsapp', 'form')),
  -- Opaque reference (e.g. a hash of the phone number), never the number itself.
  customer_ref text check (char_length(customer_ref) <= 120),
  customer_label text check (char_length(customer_label) <= 80),
  status text not null default 'active' check (status in ('active', 'ended')),
  -- Confirmed = the customer or a system confirmed it; assumed = no complaint afterwards.
  outcome text check (outcome in ('resolved_confirmed', 'resolved_assumed', 'booked', 'lead',
    'handed_off', 'abandoned', 'failed')),
  summary text check (char_length(summary) <= 2000),
  topics text[] not null default '{}',
  flags text[] not null default '{}',
  quality_score smallint check (quality_score between 0 and 100),
  ai_disclosed boolean not null default false, -- told the customer it's an AI (EU AI Act art. 50)
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  purge_after timestamptz not null default now() + interval '180 days',
  check (ended_at is null or ended_at >= started_at)
);
create index conversations_tenant_idx on public.conversations (tenant_id, started_at desc);
create index conversations_agent_idx on public.conversations (agent_id, started_at desc);
create index conversations_purge_idx on public.conversations (purge_after);

create table public.conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (role in ('customer', 'agent', 'staff', 'system')),
  body text not null check (char_length(body) <= 8000),
  created_at timestamptz not null default now()
);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, id);

-- 3. Brain decisions: references and numbers only, so the log itself holds no personal data.
create table public.agent_decisions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  config_version_id uuid references public.agent_settings_versions (id) on delete set null,
  decision text not null check (decision in ('route', 'answer_mode', 'model_select',
    'tool_authorize', 'escalate', 'budget_gate', 'compact', 'schedule')),
  intent text check (char_length(intent) <= 80),
  confidence numeric(4, 3) check (confidence between 0 and 1),
  rule_id text check (char_length(rule_id) <= 80),
  outcome text not null check (outcome in ('ok', 'asked', 'held', 'denied', 'escalated', 'failed')),
  reason text check (char_length(reason) <= 300),
  tool text check (char_length(tool) <= 80),
  risk_tier smallint check (risk_tier between 0 and 3),
  approval_id uuid,
  provider text check (provider in ('code', 'anthropic', 'groq', 'fallback')),
  model text check (char_length(model) <= 80),
  fallback_depth smallint not null default 0 check (fallback_depth between 0 and 5),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  latency_ms int check (latency_ms >= 0),
  retries smallint not null default 0 check (retries between 0 and 10),
  error_code text check (char_length(error_code) <= 80),
  guardrail_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index agent_decisions_tenant_idx on public.agent_decisions (tenant_id, created_at desc);
create index agent_decisions_conv_idx on public.agent_decisions (conversation_id);

-- 4. Approvals: an action the brain held for a person. Text inside a conversation can never
-- approve one; only a reviewer through the server can, once, before it expires.
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'), -- e.g. booking.cancel
  risk_tier smallint not null check (risk_tier between 2 and 3),
  summary text not null check (char_length(summary) between 3 and 500),
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null check (char_length(payload_hash) = 64), -- sha256 hex
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'executed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_reason text check (char_length(decision_reason) <= 500),
  executed_at timestamptz,
  check (expires_at > requested_at)
);
create index approvals_tenant_idx on public.approvals (tenant_id, status, requested_at desc);
create unique index approvals_one_pending on public.approvals (tenant_id, action, payload_hash)
  where status = 'pending';
alter table public.agent_decisions add constraint agent_decisions_approval_fk
  foreign key (approval_id) references public.approvals (id) on delete set null;

-- 5. Teaching: corrections, tests and test results.
create table public.agent_tests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  turns text[] not null check (cardinality(turns) between 1 and 20), -- what the customer says
  expectation text not null check (char_length(expectation) between 3 and 1000), -- plain English
  expected_outcome text check (expected_outcome in ('resolved_confirmed', 'booked', 'lead',
    'handed_off')),
  source text not null default 'manual' check (source in ('manual', 'conversation', 'correction')),
  source_conversation_id uuid references public.conversations (id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index agent_tests_agent_idx on public.agent_tests (agent_id);

create table public.agent_test_runs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  test_id uuid not null references public.agent_tests (id) on delete cascade,
  config_version_id uuid references public.agent_settings_versions (id) on delete set null,
  passed boolean not null,
  score smallint check (score between 0 and 100),
  notes text check (char_length(notes) <= 1000),
  ran_at timestamptz not null default now()
);
create index agent_test_runs_test_idx on public.agent_test_runs (test_id, ran_at desc);

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id bigint references public.conversation_messages (id) on delete set null,
  topic text check (char_length(topic) <= 80),
  wrong_answer text check (char_length(wrong_answer) <= 2000),
  correct_answer text not null check (char_length(correct_answer) between 3 and 2000),
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  test_id uuid references public.agent_tests (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index corrections_agent_idx on public.corrections (agent_id, status);

-- 6. Usage per tenant, agent (null = the brain itself) and day.
create table public.usage_daily (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  day date not null,
  conversations int not null default 0 check (conversations >= 0),
  llm_calls int not null default 0 check (llm_calls >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0)
);
create unique index usage_daily_key on public.usage_daily
  (tenant_id, coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), day);

-- 7. Off switches. Active rows stop work at their scope; cleared rows stay as history.
create table public.kill_switches (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'tenant', 'agent', 'tool', 'provider')),
  tenant_id uuid references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  target text check (char_length(target) <= 80), -- tool or provider name
  reason text not null check (char_length(reason) between 3 and 300),
  set_by uuid references auth.users (id) on delete set null,
  automatic boolean not null default false, -- tripped by the brain (error or volume spike)
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references auth.users (id) on delete set null,
  check (
    (scope = 'global' and tenant_id is null and agent_id is null and target is null)
    or (scope = 'tenant' and tenant_id is not null and agent_id is null and target is null)
    or (scope = 'agent' and tenant_id is not null and agent_id is not null and target is null)
    or (scope in ('tool', 'provider') and agent_id is null and target is not null)
  )
);
create unique index kill_switches_one_active on public.kill_switches
  (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(target, ''))
  where cleared_at is null;

-- 8. Hard rules.
-- Every reference (agent, conversation, settings version, test, approval, message) must belong
-- to the row's own tenant.
create function public.enforce_ops_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  t uuid := (j->>'tenant_id')::uuid;
begin
  if j ? 'agent_id' and j->>'agent_id' is not null
     and not exists (select 1 from public.agents where id = (j->>'agent_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'conversation_id' and j->>'conversation_id' is not null
     and not exists (select 1 from public.conversations where id = (j->>'conversation_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'config_version_id' and j->>'config_version_id' is not null
     and not exists (select 1 from public.agent_settings_versions where id = (j->>'config_version_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'test_id' and j->>'test_id' is not null
     and not exists (select 1 from public.agent_tests where id = (j->>'test_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'approval_id' and j->>'approval_id' is not null
     and not exists (select 1 from public.approvals where id = (j->>'approval_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'message_id' and j->>'message_id' is not null
     and not exists (select 1 from public.conversation_messages where id = (j->>'message_id')::bigint and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  if j ? 'source_conversation_id' and j->>'source_conversation_id' is not null
     and not exists (select 1 from public.conversations where id = (j->>'source_conversation_id')::uuid and tenant_id = t) then
    raise exception 'tenant_mismatch';
  end if;
  return new;
end $$;

create trigger conversations_tenant before insert or update on public.conversations
  for each row execute function public.enforce_ops_tenant();
create trigger conversation_messages_tenant before insert or update on public.conversation_messages
  for each row execute function public.enforce_ops_tenant();
create trigger agent_decisions_tenant before insert on public.agent_decisions
  for each row execute function public.enforce_ops_tenant();
create trigger approvals_tenant before insert or update on public.approvals
  for each row execute function public.enforce_ops_tenant();
create trigger agent_tests_tenant before insert or update on public.agent_tests
  for each row execute function public.enforce_ops_tenant();
create trigger agent_test_runs_tenant before insert or update on public.agent_test_runs
  for each row execute function public.enforce_ops_tenant();
create trigger corrections_tenant before insert or update on public.corrections
  for each row execute function public.enforce_ops_tenant();
create trigger usage_daily_tenant before insert or update on public.usage_daily
  for each row execute function public.enforce_ops_tenant();
create trigger kill_switches_tenant before insert or update on public.kill_switches
  for each row when (new.tenant_id is not null) execute function public.enforce_ops_tenant();

-- Messages keep the retention period of their organisation.
create function public.set_purge_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.purge_after := new.started_at
    + make_interval(days => (select retention_days from public.tenants where id = new.tenant_id));
  return new;
end $$;
create trigger conversations_purge before insert on public.conversations
  for each row execute function public.set_purge_after();

-- The decision log is append-only.
create function public.forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception 'append_only';
end $$;
create trigger agent_decisions_append_only before update on public.agent_decisions
  for each row execute function public.forbid_update();

-- Approvals move one way: pending -> approved | rejected | expired, approved -> executed.
-- The held action can't change, an expired approval can't be approved, and a rejection or
-- approval records who decided.
create function public.enforce_approval_flow() returns trigger
language plpgsql as $$
begin
  if new.action <> old.action or new.payload <> old.payload or new.payload_hash <> old.payload_hash
     or new.tenant_id <> old.tenant_id or new.risk_tier <> old.risk_tier
     or new.expires_at <> old.expires_at then
    raise exception 'approval_immutable';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if not ((old.status = 'pending' and new.status in ('approved', 'rejected', 'expired'))
          or (old.status = 'approved' and new.status = 'executed')) then
    raise exception 'approval_used';
  end if;
  if new.status = 'approved' and old.expires_at <= now() then
    raise exception 'approval_expired';
  end if;
  if new.status in ('approved', 'rejected') then
    if new.decided_by is null then
      raise exception 'approval_reviewer_required';
    end if;
    if new.status = 'rejected' and coalesce(btrim(new.decision_reason), '') = '' then
      raise exception 'approval_reason_required';
    end if;
    new.decided_at := now();
  end if;
  if new.status = 'executed' then
    new.executed_at := now();
  end if;
  return new;
end $$;
create trigger approvals_flow before update on public.approvals
  for each row execute function public.enforce_approval_flow();

-- 9. Read helpers. Conversation logs follow the per-agent rules of `can()`: view_all + logs,
-- or any personal/team grant on that agent.
create function public.can_read_agent_logs(a uuid, t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.has_tenant_permission(t, 'agents.view_all')
          and public.has_tenant_permission(t, 'agents.logs'))
    or (a is not null and exists (
      select 1 from public.agent_access aa
      where aa.agent_id = a and aa.tenant_id = t and (
        (aa.subject_type = 'user' and aa.subject_id = public.my_tenant_user(t))
        or (aa.subject_type = 'team' and aa.subject_id in (
          select tm.team_id from public.team_members tm
          where tm.tenant_user_id = public.my_tenant_user(t)))
      )
    ));
$$;

-- 10. Row-level security: read-only for signed-in users.
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.agent_decisions enable row level security;
alter table public.approvals enable row level security;
alter table public.agent_tests enable row level security;
alter table public.agent_test_runs enable row level security;
alter table public.corrections enable row level security;
alter table public.usage_daily enable row level security;
alter table public.kill_switches enable row level security;

create policy conversations_read on public.conversations for select to authenticated
  using (public.platform_role() in ('super_admin', 'platform_admin', 'support')
         or public.can_read_agent_logs(agent_id, tenant_id));

create policy conversation_messages_read on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
                 and (public.platform_role() in ('super_admin', 'platform_admin', 'support')
                      or public.can_read_agent_logs(c.agent_id, c.tenant_id))));

create policy agent_decisions_read on public.agent_decisions for select to authenticated
  using (public.platform_role() in ('super_admin', 'platform_admin', 'support')
         or public.can_read_agent_logs(agent_id, tenant_id));

create policy approvals_read on public.approvals for select to authenticated
  using (public.platform_role() in ('super_admin', 'platform_admin', 'support')
         or public.can_read_agent_logs(agent_id, tenant_id));

create policy agent_tests_read on public.agent_tests for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

create policy agent_test_runs_read on public.agent_test_runs for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

create policy corrections_read on public.corrections for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

create policy usage_daily_read on public.usage_daily for select to authenticated
  using (public.platform_role() is not null
         or public.has_tenant_permission(tenant_id, 'billing.view')
         or (agent_id is not null and public.can_see_agent(agent_id, tenant_id)));

-- Global and provider-wide switches are Wyrm's; tenants see only their own.
create policy kill_switches_read on public.kill_switches for select to authenticated
  using (public.platform_role() is not null
         or (tenant_id is not null and public.has_tenant_permission(tenant_id, 'agents.view_all')));

-- 11. Privileges.
grant select on public.conversations, public.conversation_messages, public.agent_decisions,
  public.approvals, public.agent_tests, public.agent_test_runs, public.corrections,
  public.usage_daily, public.kill_switches to authenticated;
grant select, insert, update, delete on public.conversations, public.conversation_messages,
  public.agent_decisions, public.approvals, public.agent_tests, public.agent_test_runs,
  public.corrections, public.usage_daily, public.kill_switches to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.can_read_agent_logs(uuid, uuid) to authenticated, service_role;
