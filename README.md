# BISA Campus Marketplace

BISA (Let's Do Business & Share Ideas) connects student entrepreneurs with campus shoppers. The public site remains a small HTML/CSS/JavaScript project; Vercel serverless functions connect it securely to Supabase.

## Pages and code

- `index.html`, `explore.html`, `business.html`, `about.html`, `contact.html` — public marketplace
- `admin-login.html`, `admin.html` — invite-only administrator portal
- `site-shell.js` — shared header and footer rendered across all pages
- `script.js`, `admin-dashboard.js` — public application/listing interactions and admin dashboard
- `api/` — server-only Vercel endpoints for Supabase, private file uploads, SMS and administration
- `supabase/schema.sql` — fresh-project schema and policies
- `supabase/migrations/` — migration for an existing BISA demo database
- `supabase/README.md` — setup, permissions, environment and local development

## Setup

Follow [`supabase/README.md`](./supabase/README.md) to apply the SQL, create the primary administrator, and configure Vercel and Arkesel. The website intentionally shows backend errors instead of claiming local-only submissions or demo SMS sends succeeded.

Preview static layouts with:

```powershell
python -m http.server 8000
```

To test authentication, application submissions, private media, admin features or SMS, run the Vercel development server with the required environment variables configured. Static Python preview does not run the `/api/` functions.

Do not commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY` or `ARKESEL_API_KEY` in browser code.
