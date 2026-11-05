# Dashboard — notes for Claude

@AGENTS.md

Personal project dashboard: the place to log status, stack and next task for
every side project. Single user (me). Built in ~4-hour sessions, 3 days a week;
the full plan is `C:\claude_projects\misc\dashboard-PROJECT-PLAN.md`
(also in the claude.ai project "Dashboard & Side Projects").

## Current status (updated 5 Nov 2026, session 2 complete)
- **Session 1 is done and live.** Checked by hand on real Supabase data, both
  locally and on the Vercel deploy: login gate, list, add, edit, "Worked today".
- Hosting: GitHub `JasonDButt/dashboard` (`main`), Vercel auto-deploys every
  push to `main`. Env vars live in `.env.local` locally and in Vercel project
  settings; changing one in Vercel needs a redeploy to take effect.
- Supabase free plan pauses after ~1 week idle; if the live site can't load
  projects after a break, restore the project in the Supabase dashboard.
- This machine: Node on current LTS (Next 16 needs 20.9+), Git for Windows
  updated so pushes sign in via browser. npm skipped `unrs-resolver`'s install
  script (a linter dependency); fine unless `npm run lint` errors about a
  missing native binding, then `npm install-scripts approve unrs-resolver`
  and reinstall.
- **Session 2 is done and live: Claude can read/edit projects over MCP.** The
  claude.ai custom connector works from project chat (reads and a change
  confirmed on the live site, 5 Nov).
- Next up: Session 3, weekly view + idea backlog (see Roadmap).
- Decision (3 Nov): Claude edits go through our own MCP endpoint, not
  Supabase's MCP server: works from claude.ai chat/phone, can only do what
  the tools allow (no delete), and reuses the web form validation. Auth is a
  fixed bearer token, which claude.ai connectors send via "Request headers".
- Connector setup that works: URL `<site>/api/mcp`, authentication "No sign-in",
  request header `authorization`, value = the bare token from `.env.local`.
  Headers can't be edited after adding: remove the connector and add it again.
  If it won't connect, Vercel's logs show `[mcp] refused` with the token's
  shape; `tokenLength: 70` meant "Bearer" was stuck to the token, no space.
- Decision: login is HTTP Basic Auth in `src/proxy.ts` instead of Supabase
  Auth/Clerk, a deliberate shortcut for a single-user v0. Revisit only if a
  second user or per-user data is ever needed.
- Fonts come from the `geist` npm package rather than `next/font/google`, so
  builds don't depend on reaching Google Fonts.

## Working rules
- **One finishable thing per session.** If a task won't fit in ~3 hours,
  split it and say so before starting.
- **Keep v0 small.** Out of scope until explicitly asked: multi-user, real auth
  beyond the single login, notifications, integrations, tests beyond a quick
  manual check.
- I'm rusty: explain *why* when introducing a Next.js 16 / Supabase pattern I
  might not know, briefly.
- When done with a change: run `npm run lint` and `npm run build`, then say
  what to click to check it by hand.

## Stack (per `project-scaffold`)
- Next.js 16 (App Router, Turbopack, **Cache Components on**), TypeScript, Tailwind 4
- Supabase Postgres via `@supabase/supabase-js`, **server-side only**
- Deploy: Vercel
- Fonts from the `geist` package (local files, no Google Fonts fetch at build)

## How the code is laid out
- `src/proxy.ts` — the login gate (HTTP Basic Auth on every route except
  `/api/mcp`, plus `/.well-known/*`, which must 404 so MCP clients see "no
  OAuth here"). In Next 16, `middleware.ts` was renamed to `proxy.ts`.
- `src/app/api/mcp/route.ts` — MCP endpoint (`mcp-handler` 2.x, MCP SDK v2,
  zod 4). Checks `Authorization: Bearer $DASHBOARD_MCP_TOKEN` itself. Tools:
  list_projects, list_archived_projects, get_project, add_project,
  update_project, mark_worked_today, archive_project, restore_project.
  **No delete tool, on purpose:** deleting is for the human, on the web pages.
  When the app gains a feature Claude should use (e.g. backlog), add a tool.
- `src/lib/supabase.ts` — server-only client using `SUPABASE_SECRET_KEY`.
  Never import it (or anything that imports it) from a `"use client"` file.
- `src/lib/projects.ts` — all reads/writes for the `projects` table, plus
  `validateProject`, the one set of field rules used by both the forms and
  the MCP tools. Reads call `await connection()` so they run per request.
- `src/app/actions.ts` — server actions (create, save, mark worked today,
  archive, restore, delete).
- `src/app/page.tsx` — project list. `src/app/archive` — archived projects.
  `src/app/projects/new`, `src/app/projects/[id]` — add and edit forms (shared
  `src/components/ProjectForm.tsx`); the edit page also has archive and delete.
- `supabase/schema.sql` — the schema; re-runnable. Schema changes go here first,
  then get pasted into the Supabase SQL editor.

## Next.js 16 gotchas already hit
- With Cache Components, any uncached data read (Supabase fetch, `params`,
  `cookies()`) must sit inside `<Suspense>` or the build fails.
- `params` is a Promise: `const { id } = await params`. Type pages with the
  global `PageProps<"/route/[param]">` helper.
- New routes need `npx next typegen` (or a `next dev`/`build`) before `tsc`
  knows their `PageProps` type.

## Data model
`projects`: `id`, `name`, `status` (idea | active | paused | done),
`stack`, `next_task`, `last_worked_on` (date), `archived_at`, `created_at`,
`updated_at`. Archived = `archived_at` is set: off the main list, on `/archive`,
status kept for when it's restored.
RLS is enabled with no policies, so only the secret key can touch it.
New tables also need an explicit `grant ... to service_role` (Supabase no
longer auto-grants), or the app gets "permission denied for table".

## Roadmap
- [x] Session 1: list / add / edit projects, login gate, deploy (live 27 Oct 2026)
- [x] Session 2: MCP endpoint so Claude can add/edit projects (live 5 Nov 2026)
- [ ] Session 3: weekly view (3 session slots/week) + idea backlog
- [ ] Later: time log against the 12 hrs/week target
