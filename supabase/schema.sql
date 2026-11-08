-- Dashboard schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run: it only creates what doesn't exist yet.

create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  status         text not null default 'idea'
                 check (status in ('idea', 'active', 'paused', 'done')),
  stack          text not null default '',
  next_task      text not null default '',
  last_worked_on date,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Upgrade for databases created before archiving existed: add archived_at and
-- retire the 'dropped' status (any dropped project becomes archived + paused).
alter table public.projects add column if not exists archived_at timestamptz;
update public.projects
  set archived_at = coalesce(archived_at, now()), status = 'paused'
  where status = 'dropped';
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('idea', 'active', 'paused', 'done'));

-- Keep updated_at honest on every edit.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Row Level Security on with NO policies: the public (anon/publishable) key
-- can't read or write anything. The app talks to Supabase only from the
-- server, using the secret key, which bypasses RLS.
alter table public.projects enable row level security;

-- Newer Supabase projects don't auto-grant table access to the API roles, so
-- the secret key (which acts as service_role) needs an explicit grant.
-- anon/authenticated get nothing.
grant select, insert, update, delete on public.projects to service_role;
revoke all on public.projects from anon, authenticated;

-- Weekly view: 3 flexible session slots per week. One row per (week, slot),
-- created when a slot is first planned. week_start is that week's Monday.
create table if not exists public.work_sessions (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null check (extract(isodow from week_start) = 1),
  slot        smallint not null check (slot between 1 and 3),
  project_id  uuid references public.projects (id) on delete set null,
  goal        text not null default '',
  done_on     date,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (week_start, slot)
);

-- Idea backlog: somewhere to dump ideas before they become projects.
create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists work_sessions_set_updated_at on public.work_sessions;
create trigger work_sessions_set_updated_at
  before update on public.work_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

-- Same lock-down as projects: RLS on, no policies, secret key only.
alter table public.work_sessions enable row level security;
alter table public.ideas enable row level security;
grant select, insert, update, delete on public.work_sessions to service_role;
grant select, insert, update, delete on public.ideas to service_role;
revoke all on public.work_sessions from anon, authenticated;
revoke all on public.ideas from anon, authenticated;

-- Starter rows: the three tracks from the project plan.
insert into public.projects (name, status, stack, next_task, last_worked_on)
select * from (values
  ('Dashboard',   'active', 'Next.js 16 + Supabase + Tailwind, Vercel', 'Session 2: weekly view + idea backlog', current_date),
  ('SaaS idea',   'idea',   'Next.js + Supabase (per project-scaffold)', 'Pick one idea and spec it with idea-to-spec', null::date),
  ('Trading bot', 'idea',   'Python, pandas, backtesting.py',            'Data pipeline + first moving-average backtest', null::date)
) as seed(name, status, stack, next_task, last_worked_on)
where not exists (select 1 from public.projects);
