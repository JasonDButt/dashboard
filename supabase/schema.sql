-- Dashboard schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run: it only creates what doesn't exist yet.

create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  status         text not null default 'idea'
                 check (status in ('idea', 'active', 'paused', 'done', 'dropped')),
  stack          text not null default '',
  next_task      text not null default '',
  last_worked_on date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

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

-- Starter rows: the three tracks from the project plan.
insert into public.projects (name, status, stack, next_task, last_worked_on)
select * from (values
  ('Dashboard',   'active', 'Next.js 16 + Supabase + Tailwind, Vercel', 'Session 2: weekly view + idea backlog', current_date),
  ('SaaS idea',   'idea',   'Next.js + Supabase (per project-scaffold)', 'Pick one idea and spec it with idea-to-spec', null::date),
  ('Trading bot', 'idea',   'Python, pandas, backtesting.py',            'Data pipeline + first moving-average backtest', null::date)
) as seed(name, status, stack, next_task, last_worked_on)
where not exists (select 1 from public.projects);
