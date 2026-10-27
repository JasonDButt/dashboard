import { connection } from "next/server";
import { db } from "./supabase";

export const STATUSES = ["idea", "active", "paused", "done", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export type Project = {
  id: string;
  name: string;
  status: Status;
  stack: string;
  next_task: string;
  last_worked_on: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
};

export type ProjectInput = Pick<
  Project,
  "name" | "status" | "stack" | "next_task" | "last_worked_on"
>;

// Active work first, finished/dropped last.
const STATUS_ORDER: Record<Status, number> = {
  active: 0,
  paused: 1,
  idea: 2,
  done: 3,
  dropped: 4,
};

export async function listProjects(): Promise<Project[]> {
  await connection(); // always read fresh at request time, never at build
  const { data, error } = await db()
    .from("projects")
    .select("*")
    .order("last_worked_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load projects: ${error.message}`);
  return (data as Project[]).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
}

export async function getProject(id: string): Promise<Project | null> {
  await connection();
  const { data, error } = await db()
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load project: ${error.message}`);
  return data as Project | null;
}

export async function insertProject(input: ProjectInput): Promise<void> {
  const { error } = await db().from("projects").insert(input);
  if (error) throw new Error(`Couldn't save project: ${error.message}`);
}

export async function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<void> {
  const { error } = await db().from("projects").update(input).eq("id", id);
  if (error) throw new Error(`Couldn't update project: ${error.message}`);
}

/** Turns submitted form fields into a validated ProjectInput. */
export function parseProjectForm(form: FormData): ProjectInput {
  const name = String(form.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const status = String(form.get("status") ?? "idea") as Status;
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);

  const date = String(form.get("last_worked_on") ?? "").trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Last worked on must be a date.");
  }

  return {
    name,
    status,
    stack: String(form.get("stack") ?? "").trim(),
    next_task: String(form.get("next_task") ?? "").trim(),
    last_worked_on: date || null,
  };
}
