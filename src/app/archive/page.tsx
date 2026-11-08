import { Suspense } from "react";
import Link from "next/link";
import { listArchivedProjects } from "@/lib/projects";
import { dateInZone, describeLastWorked, todayISO } from "@/lib/dates";
import { DeleteButton } from "@/components/DeleteButton";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteProject, restoreProject } from "@/app/actions";

export default function ArchivePage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Archive</h1>
        <Link href="/" className="text-sm text-stone-500 hover:underline">
          Back to projects
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-sm text-stone-500">Loading archive…</p>}
      >
        <ArchivedList />
      </Suspense>
    </>
  );
}

async function ArchivedList() {
  const projects = await listArchivedProjects();
  const today = todayISO();

  if (projects.length === 0) {
    return <p className="text-sm text-stone-500">Nothing archived.</p>;
  }

  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <li
          key={p.id}
          className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
        >
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
            <div className="flex items-center gap-2">
              <form action={restoreProject.bind(null, p.id)}>
                <button
                  type="submit"
                  className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  Restore
                </button>
              </form>
              <DeleteButton
                action={deleteProject.bind(null, p.id)}
                name={p.name}
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-500">
            Archived {dateInZone(p.archived_at!)}, last worked{" "}
            {describeLastWorked(p.last_worked_on, today)}
          </p>
        </li>
      ))}
    </ul>
  );
}
