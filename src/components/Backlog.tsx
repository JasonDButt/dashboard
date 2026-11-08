import { listIdeas } from "@/lib/ideas";
import { shortDate, dateInZone } from "@/lib/dates";
import { DeleteButton } from "@/components/DeleteButton";
import { addIdea, deleteIdea, promoteIdea } from "@/app/actions";

const input =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900";
const smallButton =
  "rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

/** Idea backlog: quick add, then promote or delete. Async: wrap in <Suspense>. */
export async function Backlog() {
  const ideas = await listIdeas();

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Idea backlog{" "}
        <span className="text-sm font-normal text-stone-500">({ideas.length})</span>
      </h2>

      {/* React resets this form after a successful submit, ready for the next idea. */}
      <form action={addIdea} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          name="title"
          required
          placeholder="New idea"
          className={`${input} sm:w-1/3`}
          aria-label="Idea title"
        />
        <input
          name="notes"
          placeholder="Notes (optional)"
          className={input}
          aria-label="Idea notes"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          Add idea
        </button>
      </form>

      {ideas.length === 0 ? (
        <p className="text-sm text-stone-500">No ideas parked yet.</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{idea.title}</p>
                {idea.notes && <p className="text-stone-500">{idea.notes}</p>}
                <p className="text-xs text-stone-400">
                  added {shortDate(dateInZone(idea.created_at))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={promoteIdea.bind(null, idea.id)}>
                  <button type="submit" className={smallButton}>
                    Promote to project
                  </button>
                </form>
                <DeleteButton
                  action={deleteIdea.bind(null, idea.id)}
                  name={idea.title}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
