# Dashboard

Personal dashboard for tracking side projects: status, stack, next task and
when each was last worked on. Single user, password-gated.

**v0 scope (session 1):** list, add and edit projects; "Worked today" button;
active projects untouched for 7+ days get flagged.
**Next (session 2):** weekly view (3 session slots/week) and an idea backlog.
**Not in v0:** multi-user, real auth, notifications, integrations.

Stack: Next.js 16 · TypeScript · Tailwind 4 · Supabase Postgres · Vercel.

## First-time setup (Windows, ~20 min)

You need Node.js 20.9+ (`node -v` to check) and a free Supabase account.

1. **Install dependencies** — in this folder:
   ```powershell
   npm install
   ```
2. **Create the database** — at supabase.com create a new project (any region
   near you, e.g. Sydney). When it's ready, open **SQL Editor → New query**,
   paste all of `supabase/schema.sql`, and click **Run**. This creates the
   `projects` table and seeds your three tracks.
3. **Add your keys** — copy the example env file and fill it in:
   ```powershell
   copy .env.example .env.local
   ```
   - `SUPABASE_URL`: Project Settings → API (or Data API) → Project URL
   - `SUPABASE_SECRET_KEY`: Project Settings → API Keys → a **secret** key
     (`sb_secret_…`), or the legacy `service_role` key
   - `DASHBOARD_PASSWORD`: anything you like; `DASHBOARD_USER` defaults to `me`
4. **Run it**:
   ```powershell
   npm run dev
   ```
   Open http://localhost:3000, log in with `DASHBOARD_USER` / `DASHBOARD_PASSWORD`.
5. **Save a first commit**:
   ```powershell
   git init
   git add .
   git commit -m "Dashboard v0: projects list/add/edit"
   ```

## Deploy to Vercel

1. Push the repo to GitHub (new private repo, then follow GitHub's
   "push an existing repository" commands).
2. In Vercel: **Add New → Project**, import the repo. Framework is detected
   automatically.
3. Before clicking Deploy, add the same env vars as `.env.local`
   (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DASHBOARD_USER`,
   `DASHBOARD_PASSWORD`, `DASHBOARD_TIME_ZONE`).
4. Deploy, open the URL on your phone, log in, and add it to your home screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server on :3000 |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |

## Layout

See `CLAUDE.md` for where things live and the Next.js 16 conventions this uses.
