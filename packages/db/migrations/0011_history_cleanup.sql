-- Append-only history (agent_decisions, policy_changes) must still let the database clean up
-- after a removed agent or a deleted organisation. Before this, removing an agent with any
-- history failed: its "on delete set null" links are updates, which the append-only trigger
-- refused; and deleting an organisation failed on the policy_changes delete trigger.
--
-- Allowed now, and nothing else:
--   UPDATE that only sets columns to null (the foreign-key "set null" clean-up)
--   DELETE once the organisation itself is gone (cascade from tenants)

create or replace function public.forbid_update() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and not exists (
       select 1
       from jsonb_each(to_jsonb(old)) o
       join jsonb_each(to_jsonb(new)) n using (key)
       where o.value is distinct from n.value and n.value <> 'null'::jsonb
     ) then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.tenants where id = old.tenant_id) then
    return old;
  end if;
  raise exception 'append_only';
end $$;
