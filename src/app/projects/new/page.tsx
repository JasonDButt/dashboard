import { ProjectForm } from "@/components/ProjectForm";
import { createProject } from "@/app/actions";

export default function NewProjectPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">New project</h1>
      <ProjectForm action={createProject} submitLabel="Add project" />
    </>
  );
}
