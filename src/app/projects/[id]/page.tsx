import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { ProjectForm } from "@/components/ProjectForm";
import { saveProject } from "@/app/actions";

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
    <ProjectForm
      action={saveProject.bind(null, project.id)}
      project={project}
      submitLabel="Save changes"
    />
  );
}
