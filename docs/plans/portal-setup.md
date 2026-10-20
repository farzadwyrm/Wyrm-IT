# Portal setup (owner steps)

Do these once. Never paste keys or passwords into chat.

## 1. Supabase project
1. supabase.com → sign in with GitHub → organisation "Wyrm" (Free).
2. New project `wyrm-portal`, region **Central EU (Frankfurt)**, generated database password
   saved in your password manager.

## 2. Create the tables
SQL Editor → New query → paste all of `packages/db/migrations/0001_portal_foundations.sql`
→ Run. You should see "Success. No rows returned".

## 3. Sign-in settings
Authentication → Sign In / Providers → Email: enabled. Turn **off** "Allow new users to sign up"
(the portal is invite-only).

Authentication → URL Configuration:
- Site URL: `http://localhost:3001` (change to the live portal address when deployed)
- Redirect URLs: add `http://localhost:3001/**` (and later the live address with `/**`)

Authentication → Emails → Templates: in **Magic link** and **Invite user**, replace the link
with these (the portal verifies the link on its server, which works in any browser):
- Magic link: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>`
- Invite user: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a>`

## 4. Connect the portal on your computer
Copy `apps/portal/.env.example` to `apps/portal/.env.local` and paste the three values from
Project Settings → API keys. Then run `pnpm --filter @wyrm/portal dev` and open
http://localhost:3001.

## 5. Make yourself the first admin
1. Authentication → Users → Add user → "Send invitation" to your own email; accept it.
2. SQL Editor, run (replace the email):
   `insert into public.wyrm_admins (user_id) select id from auth.users where email = 'you@example.com';`
3. Sign in at http://localhost:3001: you'll see **Admin**, where you create clients.

## 6. Deploy (later)
Vercel → Add New Project → same GitHub repo → Root Directory `apps/portal` → add the three
environment variables → Deploy. Then update the Site URL and Redirect URLs in Supabase.
