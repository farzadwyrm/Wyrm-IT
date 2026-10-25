-- Wyrm agents over MCP, phase 0 (docs/research/reports/Wyrm agents over MCP.md).
--
--   oauth_clients  AI apps (Claude, ChatGPT, Copilot...) registered with Wyrm's OAuth server
--   oauth_grants   authorization codes, access tokens and refresh tokens, stored only as
--                  SHA-256 hashes, each bound to one client, one login and one organisation
--
-- Server-only tables: no policies for signed-in users, so only the server (after its own
-- checks) can read or write them. Tokens die with their user, client or organisation.

create table public.oauth_clients (
  client_id text primary key check (char_length(client_id) between 8 and 300),
  client_name text not null default '' check (char_length(client_name) <= 200),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('code', 'access', 'refresh')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scope text not null default '' check (char_length(scope) <= 200),
  -- The MCP endpoint the token is for (RFC 8707); a token for another resource is refused.
  resource text not null check (char_length(resource) <= 300),
  redirect_uri text check (char_length(redirect_uri) <= 500),
  code_challenge text check (char_length(code_challenge) <= 128),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index oauth_grants_tenant_idx on public.oauth_grants (tenant_id, kind);

alter table public.oauth_clients enable row level security;
alter table public.oauth_grants enable row level security;
grant select, insert, update, delete on public.oauth_clients, public.oauth_grants to service_role;
