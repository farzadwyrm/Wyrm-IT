# Launch checklist: putting the website live

## 1. Deploy on Vercel (free)

1. Go to https://vercel.com/signup and choose **Continue with GitHub** (account farzadwyrm).
2. Click **Add New → Project**, find **Wyrm-IT** and click **Import**.
   If it is not listed, click **Adjust GitHub App Permissions** and allow the Wyrm-IT repository.
3. Settings on the import screen:
   - **Root Directory:** `apps/web` (click Edit and select it).
   - Framework is detected as **Next.js**. Leave build and install commands as default.
   - **Environment Variables:** add `NEXT_PUBLIC_SITE_URL` = the `https://….vercel.app` address
     (you can fill it after the first deploy and redeploy).
4. Click **Deploy**. After about a minute you get a public `….vercel.app` link.

From then on, every push to `main` redeploys automatically, and every pull request gets its own
preview link.

## 2. Booking and email (when ready)

- Create a free https://cal.com account with a 30-minute "Intro call" event.
  Put its link in Vercel as `NEXT_PUBLIC_BOOKING_URL`, then redeploy.
- When you have a business email address, add `NEXT_PUBLIC_CONTACT_EMAIL`.
- Until these are set, the site shows "Online booking opens soon" instead of a broken link.

## 3. Domain (when bought)

Vercel → Project → Settings → Domains → add the domain and follow the DNS instructions.
Then set `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and redeploy.

## 4. Before telling anyone about the site

- [ ] Read every page and fix anything that is not true for you (About text, promises on Contact).
- [ ] Booking link works from a phone.
- [ ] Ask two friends to open it on their phones and tell you what is confusing.
