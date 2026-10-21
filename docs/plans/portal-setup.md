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
Authentication → Sign In / Providers: turn **off** "Allow new users to sign up" (invite-only).

Authentication → URL Configuration:
- Site URL: the live portal, `https://wyrm-portal.vercel.app`
- Redirect URLs: `https://wyrm-portal.vercel.app/**` only (no localhost).

Email templates stay as Supabase's defaults: the portal handles them (`/auth/confirm` for
sign-in links, `/auth/callback` for invitations). Supabase's built-in email sender only
delivers to members of the Supabase organisation and a few emails per hour, so before
inviting real clients set up custom SMTP (e.g. Resend) under Authentication → Emails.

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
Vercel → Add New Project → same GitHub repo → "Import single project" for `apps/portal`
(project name `wyrm-portal`). Then Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as type **Config**
  (Vercel refuses `NEXT_PUBLIC_` names as Secret; they are public by design).
- `SUPABASE_SECRET_KEY` as type **Secret**, in its own form.
Deploy, then set the Site URL and Redirect URLs in Supabase to the live address.
