import Link from "next/link";
import { STATUSES, type Project } from "@/lib/projects";

const input =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900";
const label = "mb-1 block text-sm font-medium";

export function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (form: FormData) => Promise<void>;
  project?: Project;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className={label}>
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={project?.name}
          className={input}
          autoFocus={!project}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className={label}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={project?.status ?? "idea"}
            className={input}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="last_worked_on" className={label}>
            Last worked on
          </label>
          <input
            id="last_worked_on"
            name="last_worked_on"
            type="date"
            defaultValue={project?.last_worked_on ?? ""}
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="stack" className={label}>
          Stack
        </label>
        <input
          id="stack"
          name="stack"
          placeholder="e.g. Next.js + Supabase"
          defaultValue={project?.stack}
          className={input}
        />
      </div>

      <div>
        <label htmlFor="next_task" className={label}>
          Next task
        </label>
        <textarea
          id="next_task"
          name="next_task"
          rows={3}
          placeholder="The one thing to do next session"
          defaultValue={project?.next_task}
          className={input}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          {submitLabel}
        </button>
        <Link href="/" className="text-sm text-stone-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
