import { connection } from "next/server";
import { db } from "./supabase";
import { insertProject, validateProject, type Project } from "./projects";

// The idea backlog: dump ideas here, promote the good ones to projects.

export type Idea = {
  id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type IdeaInput = Pick<Idea, "title" | "notes">;

/** Newest first. */
export async function listIdeas(): Promise<Idea[]> {
  await connection();
  const { data, error } = await db()
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load ideas: ${error.message}`);
  return data as Idea[];
}

export async function getIdea(id: string): Promise<Idea | null> {
  const { data, error } = await db()
    .from("ideas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load idea: ${error.message}`);
  return data as Idea | null;
}

export async function insertIdea(input: IdeaInput): Promise<Idea> {
  const { data, error } = await db()
    .from("ideas")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(`Couldn't save idea: ${error.message}`);
  return data as Idea;
}

export async function updateIdea(
  id: string,
  input: Partial<IdeaInput>,
): Promise<Idea> {
  const { data, error } = await db()
    .from("ideas")
    .update(input)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Couldn't update idea: ${error.message}`);
  if (!data) throw new Error(`No idea with id ${id}.`);
  return data as Idea;
}

/** Web pages only (behind the login); the MCP endpoint has no delete. */
export async function removeIdea(id: string): Promise<void> {
  const { error } = await db().from("ideas").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete idea: ${error.message}`);
}

/**
 * Turns an idea into a project (status "idea", notes become its next task)
 * and removes it from the backlog.
 */
export async function promoteIdea(id: string): Promise<Project> {
  const idea = await getIdea(id);
  if (!idea) throw new Error(`No idea with id ${id}.`);
  const project = await insertProject(
    validateProject({ name: idea.title, status: "idea", next_task: idea.notes }),
  );
  await removeIdea(id);
  return project;
}

/** The one set of rules for an idea, shared by the form and MCP. */
export function validateIdea(raw: Record<string, unknown>): IdeaInput {
  const title = String(raw.title ?? "").trim();
  if (!title) throw new Error("Idea title is required.");
  return { title, notes: String(raw.notes ?? "").trim() };
}
