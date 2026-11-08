import { Suspense } from "react";
import Link from "next/link";
import { listAllSessions, type WorkSession } from "@/lib/sessions";
import { shortDate } from "@/lib/dates";

export default function PastWeeksPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Past weeks</h1>
        <Link href="/" className="text-sm text-stone-500 hover:underline">
          Back to dashboard
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
        <WeekList />
      </Suspense>
    </>
  );
}

async function WeekList() {
  const sessions = await listAllSessions();
  if (sessions.length === 0) {
    return <p className="text-sm text-stone-500">No sessions planned yet.</p>;
  }

  // Already sorted newest week first, then by slot.
  const weeks = new Map<string, WorkSession[]>();
  for (const s of sessions) {
    weeks.set(s.week_start, [...(weeks.get(s.week_start) ?? []), s]);
  }

  return (
    <div className="space-y-4">
      {[...weeks].map(([weekStart, rows]) => (
        <section
          key={weekStart}
          className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
        >
          <h2 className="mb-2 font-medium">
            Week of {shortDate(weekStart)}{" "}
            <span className="text-sm font-normal text-stone-500">
              ({rows.filter((r) => r.done_on).length}/3 done)
            </span>
          </h2>
          <ul className="space-y-1 text-sm">
            {rows.map((s) => (
              <li key={s.id}>
                <span className="text-stone-500">Session {s.slot}:</span>{" "}
                {s.project?.name ?? "No project"}
                {s.goal && <span className="text-stone-500"> — {s.goal}</span>}
                {s.done_on ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {" "}
                    ✓ {shortDate(s.done_on)}
                  </span>
                ) : (
                  <span className="text-stone-400"> (not done)</span>
                )}
                {s.note && <p className="ml-4 italic text-stone-500">{s.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
