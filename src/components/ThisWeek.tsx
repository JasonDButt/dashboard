import Link from "next/link";
import { connection } from "next/server";
import { listProjects, type Project } from "@/lib/projects";
import {
  formatHours,
  DEFAULT_SLOTS,
  getWeek,
  isEmpty,
  MAX_SLOTS,
  totalHours,
  WEEKLY_HOURS_TARGET,
  type WorkSession,
} from "@/lib/sessions";
import { shortDate, todayISO, weekStartOf } from "@/lib/dates";
import {
  addSession,
  clearSession,
  completeSession,
  logSessionHours,
  planSession,
  removeSession,
  reopenSession,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

const hoursInput =
  "w-16 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900";

const input =
  "w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900";
const smallButton =
  "rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

/** This week's session slots (3 or more). Async: wrap in <Suspense>. */
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
  const hours = totalHours(slots);

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          This week{" "}
          <span className="text-sm font-normal text-stone-500">
            (from {shortDate(weekStart)}, {done}/{slots.length} done)
          </span>
        </h2>
        <Link href="/weeks" className="text-sm text-stone-500 hover:underline">
          Past weeks
        </Link>
      </div>
      <HoursBar hours={hours} target={WEEKLY_HOURS_TARGET} />
      {/* One row that scrolls sideways once there are more cards than fit. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {slots.map((session, i) => (
          <SlotCard
            key={i + 1}
            weekStart={weekStart}
            slot={i + 1}
            session={session}
            projects={projects}
            shownCount={slots.length}
          />
        ))}
        {slots.length < MAX_SLOTS && (
          <form
            action={addSession.bind(null, weekStart, slots.length)}
            className="flex shrink-0"
          >
            <SubmitButton
              className="w-28 rounded-lg border border-dashed border-stone-300 text-sm text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900"
            >
              + Add session
            </SubmitButton>
          </form>
        )}
      </div>
    </section>
  );
}

/** "7.5 / 12 hrs" with a bar; turns green once the target is reached. */
export function HoursBar({ hours, target }: { hours: number; target: number }) {
  const pct = Math.min(100, Math.round((hours / target) * 100));
  const reached = hours >= target;
  return (
    <div className="mb-3 flex items-center gap-3 text-sm">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
        role="progressbar"
        aria-valuenow={hours}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label="Hours this week"
      >
        <div
          className={`h-full rounded-full ${reached ? "bg-emerald-600" : "bg-stone-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={reached ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-stone-500"}>
        {Math.round(hours * 100) / 100} / {formatHours(target)}
      </span>
    </div>
  );
}

function SlotCard({
  weekStart,
  slot,
  session,
  projects,
  shownCount,
}: {
  weekStart: string;
  slot: number;
  session: WorkSession | null;
  projects: Project[];
  shownCount: number; // how many sessions this week shows
}) {
  const card =
    "w-64 shrink-0 snap-start rounded-lg border p-3 text-sm " +
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
        <form
          action={logSessionHours.bind(null, weekStart, slot)}
          className="mt-3 flex items-center gap-2"
        >
          <input
            name="hours"
            inputMode="decimal"
            defaultValue={session.hours ?? ""}
            placeholder="hrs"
            className={hoursInput}
            aria-label={`Session ${slot} hours`}
          />
          <span className="text-xs text-stone-500">hrs</span>
          <SubmitButton className={smallButton}>
            Save
          </SubmitButton>
          <SubmitButton
            formAction={reopenSession.bind(null, weekStart, slot)}
            className="ml-auto text-xs text-stone-500 hover:underline"
          >
            Reopen
          </SubmitButton>
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
  // Hours logged on an unplanned session (e.g. by Claude) also count as in
  // use: it gets the done/clear form rather than Remove.
  const inUse = !isEmpty(session);

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
        <div className="flex items-center gap-2">
          <SubmitButton className={smallButton}>
            {planned ? "Update plan" : "Plan"}
          </SubmitButton>
          {/* An empty session can be taken out (later ones renumber down)
              while the week has more than the default 3. */}
          {!inUse && shownCount > DEFAULT_SLOTS && (
            <SubmitButton
              formAction={removeSession.bind(null, weekStart, slot, shownCount)}
              className="text-xs text-stone-500 hover:underline"
            >
              Remove
            </SubmitButton>
          )}
        </div>
      </form>

      {inUse && (
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
            <input
              name="hours"
              inputMode="decimal"
              defaultValue={session?.hours ?? ""}
              placeholder="hrs"
              className={hoursInput}
              aria-label={`Session ${slot} hours`}
            />
            <SubmitButton
              className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Done today
            </SubmitButton>
            <SubmitButton
              formAction={clearSession.bind(null, weekStart, slot)}
              className="text-xs text-stone-500 hover:underline"
            >
              Clear
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
