# BISA Campus Marketplace

BISA is a student-first campus marketplace where student entrepreneurs can list their businesses and students can discover nearby products, services and opportunities.

## Project structure

- `index.html` — homepage
- `explore.html` — marketplace listings page
- `business.html` — business application form
- `about.html` — about page
- `contact.html` — contact page
- `admin.html` — lightweight admin dashboard
- `style.css` — styling for the full site
- `script.js` — demo application logic, validation, dashboard interactions
- `supabase/schema.sql` — Supabase database schema and policies
- `supabase/README.md` — setup and deployment notes
- `.env.example` — sample environment variables for Supabase and SMS

## Notes

- This is intentionally a simple static front-end so it remains easy to understand.
- The application and admin demos are powered by browser localStorage for a lightweight prototype.
- The Supabase schema is included to support a real production-ready backend when connected to a valid Supabase project.

## Local preview

Open the project in a browser, or run a simple local server from the project folder:

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```
