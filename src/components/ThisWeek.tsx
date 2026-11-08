import Link from "next/link";
import { connection } from "next/server";
import { listProjects, type Project } from "@/lib/projects";
import { getWeek, SLOTS, type WorkSession } from "@/lib/sessions";
import { shortDate, todayISO, weekStartOf } from "@/lib/dates";
import {
  clearSession,
  completeSession,
  planSession,
  reopenSession,
} from "@/app/actions";

const input =
  "w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900";
const smallButton =
  "rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

/** This week's 3 session slots. Async: wrap in <Suspense>. */
export async function ThisWeek() {
  // "This week" depends on today, so it must be worked out per request, not
  // baked in at build time (Cache Components).
  await connection();
  const weekStart = weekStartOf(todayISO());
  const [slots, projects] = await Promise.all([
    getWeek(weekStart),
    listProjects(),
  ]);
  const done = slots.filter((s) => s?.done_on).length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          This week{" "}
          <span className="text-sm font-normal text-stone-500">
            (from {shortDate(weekStart)}, {done}/{SLOTS.length} done)
          </span>
        </h2>
        <Link href="/weeks" className="text-sm text-stone-500 hover:underline">
          Past weeks
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {SLOTS.map((slot, i) => (
          <SlotCard
            key={slot}
            weekStart={weekStart}
            slot={slot}
            session={slots[i]}
            projects={projects}
          />
        ))}
      </div>
    </section>
  );
}

function SlotCard({
  weekStart,
  slot,
  session,
  projects,
}: {
  weekStart: string;
  slot: number;
  session: WorkSession | null;
  projects: Project[];
}) {
  const card =
    "rounded-lg border p-3 text-sm " +
    (session?.done_on
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
      : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900");

  if (session?.done_on) {
    return (
      <div className={card}>
        <p className="font-medium">
          Session {slot}{" "}
          <span className="font-normal text-emerald-700 dark:text-emerald-400">
            ✓ done {shortDate(session.done_on)}
          </span>
        </p>
        <p className="mt-2">{session.project?.name ?? "No project"}</p>
        {session.goal && <p className="text-stone-500">{session.goal}</p>}
        {session.note && <p className="mt-1 italic">{session.note}</p>}
        <form action={reopenSession.bind(null, weekStart, slot)} className="mt-3">
          <button type="submit" className={smallButton}>
            Reopen
          </button>
        </form>
      </div>
    );
  }

  // A slot's project may since have been archived; keep it selectable.
  const options =
    session?.project_id && !projects.some((p) => p.id === session.project_id)
      ? [{ id: session.project_id, name: session.project?.name ?? "(archived)" }]
      : [];
  const planned = Boolean(session?.project_id || session?.goal);

  return (
    <div className={card}>
      <p className="font-medium">Session {slot}</p>
      <form
        action={planSession.bind(null, weekStart, slot)}
        className="mt-2 space-y-2"
      >
        <select
          name="project_id"
          defaultValue={session?.project_id ?? ""}
          className={input}
          aria-label={`Session ${slot} project`}
        >
          <option value="">Pick a project…</option>
          {[...projects, ...options].map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          name="goal"
          defaultValue={session?.goal}
          placeholder="Goal for this session"
          className={input}
          aria-label={`Session ${slot} goal`}
        />
        <button type="submit" className={smallButton}>
          {planned ? "Update plan" : "Plan"}
        </button>
      </form>

      {planned && (
        <form
          action={completeSession.bind(null, weekStart, slot)}
          className="mt-3 space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800"
        >
          <input
            name="note"
            placeholder="How did it go? (optional)"
            className={input}
            aria-label={`Session ${slot} note`}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Done today
            </button>
            <button
              type="submit"
              formAction={clearSession.bind(null, weekStart, slot)}
              className="text-xs text-stone-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
