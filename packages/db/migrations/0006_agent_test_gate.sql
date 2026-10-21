-- Wyrm portal v5: Test & Publish (docs/plans/agent-studio-roadmap.md, phase 2).
-- A test states what the agent must DO (action), whether it must HAND OFF, and a plain-English
-- expectation for what it SAYS. Required tests must pass before a policy can be published.
-- Results are stored per run (a run tests one draft or live policy), with the three checks apart.

alter table public.agent_tests
  add column expected_action text
    check (expected_action is null or expected_action ~ '^(none|[a-z_]+\.(request|held))$'),
  add column expected_handoff boolean,
  add column required boolean not null default true,
  add column template text
    check (template is null or template in ('book', 'reschedule', 'cancel', 'message', 'transfer', 'quote', 'safety'));

create table public.agent_test_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  target text not null check (target in ('draft', 'live')),
  started_by uuid references auth.users (id) on delete set null,
  total int not null default 0 check (total >= 0),
  passed int not null default 0 check (passed >= 0),
  required_failed int not null default 0 check (required_failed >= 0),
  created_at timestamptz not null default now()
);
create index agent_test_batches_agent_idx on public.agent_test_batches (agent_id, created_at desc);

alter table public.agent_test_runs
  add column batch_id uuid references public.agent_test_batches (id) on delete cascade,
  add column reply_ok boolean,      -- null: no judge available (not counted as a failure)
  add column action_ok boolean,
  add column handoff_ok boolean,
  add column transcript jsonb not null default '[]'::jsonb,
  add column trace jsonb not null default '[]'::jsonb;
create index agent_test_runs_batch_idx on public.agent_test_runs (batch_id);

create trigger agent_test_batches_tenant before insert or update on public.agent_test_batches
  for each row execute function public.enforce_ops_tenant();

alter table public.agent_test_batches enable row level security;
create policy agent_test_batches_read on public.agent_test_batches for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));

grant select on public.agent_test_batches to authenticated;
grant select, insert, update, delete on public.agent_test_batches to service_role;
