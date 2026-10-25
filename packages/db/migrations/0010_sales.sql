-- Wyrm portal: Sales agent (phase 1). Plan: docs/plans/sales-agent.md.
--
--   agent_sales  what the business sells, who is a good fit, the qualifying questions and how
--                answers score (draft, per agent; published with the rest of the policy)
--   leads        one row per qualified conversation: answers, score and bucket computed in code,
--                and a status the team moves along (new, contacted, won, lost)
--
-- Same security model as 0005: read-only for signed-in users who can see the agent, every write
-- through the server after the permission check.

-- 1. New procedure template "qualify" and change-log object "sales".
alter table public.agent_procedures drop constraint agent_procedures_template_check;
alter table public.agent_procedures add constraint agent_procedures_template_check
  check (template in ('book', 'reschedule', 'cancel', 'message', 'transfer', 'quote', 'qualify'));

alter table public.agent_tests drop constraint agent_tests_template_check;
alter table public.agent_tests add constraint agent_tests_template_check
  check (template is null or template in ('book', 'reschedule', 'cancel', 'message', 'transfer', 'quote', 'qualify', 'safety'));

alter table public.policy_changes drop constraint policy_changes_object_type_check;
alter table public.policy_changes add constraint policy_changes_object_type_check
  check (object_type in ('profile', 'rule', 'procedure', 'limits', 'sales', 'publish', 'restore'));

-- 2. Sales setup (one row per agent).
create table public.agent_sales (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  setup jsonb not null default '{}'::jsonb check (octet_length(setup::text) <= 20000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger agent_sales_policy before insert or update on public.agent_sales
  for each row execute function public.enforce_policy_rules();

-- 3. Leads. Deleted with their conversation (same retention).
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  contact text not null default '' check (char_length(contact) <= 200),
  answers jsonb not null default '{}'::jsonb check (octet_length(answers::text) <= 8000),
  score smallint not null default 0 check (score between -100 and 100),
  bucket text not null check (bucket in ('hot', 'warm', 'not_fit')),
  reasons text[] not null default '{}' check (cardinality(reasons) <= 20),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index leads_tenant_idx on public.leads (tenant_id, created_at desc);

create function public.enforce_lead_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations
                 where id = new.conversation_id and tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger leads_tenant before insert or update on public.leads
  for each row execute function public.enforce_lead_tenant();

-- 4. Row-level security.
alter table public.agent_sales enable row level security;
alter table public.leads enable row level security;

create policy agent_sales_read on public.agent_sales for select to authenticated
  using (public.platform_role() is not null or public.can_see_agent(agent_id, tenant_id));
create policy leads_read on public.leads for select to authenticated
  using (public.platform_role() is not null
         or (agent_id is not null and public.can_see_agent(agent_id, tenant_id)));

grant select on public.agent_sales, public.leads to authenticated;
grant select, insert, update, delete on public.agent_sales, public.leads to service_role;
