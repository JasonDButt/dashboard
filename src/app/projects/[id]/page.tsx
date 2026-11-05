import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ProjectForm } from "@/components/ProjectForm";
import {
  archiveProject,
  deleteProject,
  restoreProject,
  saveProject,
} from "@/app/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditProjectPage(props: PageProps<"/projects/[id]">) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Edit project</h1>
      <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
        <EditForm params={props.params} />
      </Suspense>
    </>
  );
}

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <>
      <ProjectForm
        action={saveProject.bind(null, project.id)}
        project={project}
        submitLabel="Save changes"
      />
      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
        <span className="mr-auto text-sm text-stone-500">
          {project.archived_at ? "This project is archived." : "Done with this?"}
        </span>
        <form
          action={(project.archived_at ? restoreProject : archiveProject).bind(
            null,
            project.id,
          )}
        >
          <button
            type="submit"
            className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            {project.archived_at ? "Restore" : "Archive"}
          </button>
        </form>
        <DeleteProjectButton
          action={deleteProject.bind(null, project.id)}
          name={project.name}
        />
      </div>
    </>
  );
}
