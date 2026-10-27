import { Suspense } from "react";
import Link from "next/link";
import { listProjects, type Project } from "@/lib/projects";
import { daysSince, describeLastWorked, todayISO } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { markWorkedToday } from "./actions";

// An active project untouched for longer than this gets flagged.
const STALE_AFTER_DAYS = 7;

export default function HomePage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Projects</h1>
      <Suspense
        fallback={<p className="text-sm text-stone-500">Loading projects…</p>}
      >
        <ProjectList />
      </Suspense>
    </>
  );
}

async function ProjectList() {
  const projects = await listProjects();
  const today = todayISO();

  if (projects.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No projects yet.{" "}
        <Link href="/projects/new" className="underline">
          Add your first one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} today={today} />
      ))}
    </ul>
  );
}

function ProjectCard({ project: p, today }: { project: Project; today: string }) {
  const days = daysSince(p.last_worked_on, today);
  const stale =
    p.status === "active" && (days === null || days > STALE_AFTER_DAYS);
  const workedToday = days === 0;

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${p.id}`}
            className="font-medium hover:underline"
          >
            {p.name}
          </Link>
          <StatusBadge status={p.status} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={
              stale
                ? "font-medium text-amber-700 dark:text-amber-400"
                : "text-stone-500"
            }
            title={p.last_worked_on ?? undefined}
          >
            {stale && "⚠ "}last worked {describeLastWorked(p.last_worked_on, today)}
          </span>
          {!workedToday && (
            <form action={markWorkedToday.bind(null, p.id)}>
              <button
                type="submit"
                className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                Worked today
              </button>
            </form>
          )}
        </div>
      </div>

      {p.next_task && (
        <p className="mt-2 text-sm">
          <span className="text-stone-500">Next: </span>
          {p.next_task}
        </p>
      )}
      {p.stack && (
        <p className="mt-1 font-mono text-xs text-stone-500">{p.stack}</p>
      )}
    </li>
  );
}
