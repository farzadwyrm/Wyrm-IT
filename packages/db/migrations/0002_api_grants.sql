-- Wyrm portal: table privileges for the Supabase Data API.
-- Newer Supabase projects don't expose new tables automatically, so grant exactly what the
-- portal uses. Row-level security (0001) still decides which rows each user sees.

-- Remove privileges that bypass row-level security or aren't needed.
revoke all on all tables in schema public from anon, authenticated;

-- Signed-in users: read; owners add staff and settings versions (policies restrict further).
grant usage on schema public to authenticated, service_role;
grant select on public.organizations, public.memberships, public.agents,
  public.profile_versions, public.audit_log, public.wyrm_admins to authenticated;
grant insert, delete on public.memberships to authenticated;
grant insert on public.profile_versions to authenticated;
grant execute on function public.is_wyrm_admin(), public.has_org_role(uuid, text[])
  to authenticated;

-- The server's secret key (admin actions only).
grant select, insert, update, delete on public.organizations, public.memberships,
  public.agents, public.profile_versions, public.audit_log, public.wyrm_admins to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Signed-out visitors (anon) get nothing.
