import type { Status } from "@/lib/projects";

const STYLES: Record<Status, string> = {
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  idea: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  done: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  dropped:
    "bg-stone-100 text-stone-500 line-through dark:bg-stone-900 dark:text-stone-500",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
