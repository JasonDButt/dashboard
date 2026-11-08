import { connection } from "next/server";
import { db } from "./supabase";
import { getProject, updateProject } from "./projects";

// The weekly view: 3 flexible session slots per week (no fixed days). A slot's
// row is created the first time it's planned or ticked done.

export const SLOTS = [1, 2, 3] as const;

export type WorkSession = {
  id: string;
  week_start: string; // the Monday, YYYY-MM-DD
  slot: number; // 1-3
  project_id: string | null;
  goal: string;
  done_on: string | null; // YYYY-MM-DD
  note: string;
  created_at: string;
  updated_at: string;
  project: { name: string } | null; // joined from projects
};

const SELECT = "*, project:projects(name)";

/** This week's 3 slots, in order; null where a slot hasn't been used yet. */
export async function getWeek(
  weekStart: string,
): Promise<(WorkSession | null)[]> {
  await connection();
  checkSlot(weekStart, 1);
  const { data, error } = await db()
    .from("work_sessions")
    .select(SELECT)
    .eq("week_start", weekStart);
  if (error) throw new Error(`Couldn't load the week: ${error.message}`);
  const rows = data as WorkSession[];
  return SLOTS.map((slot) => rows.find((r) => r.slot === slot) ?? null);
}

/** Every session ever planned, newest week first. */
export async function listAllSessions(): Promise<WorkSession[]> {
  await connection();
  const { data, error } = await db()
    .from("work_sessions")
    .select(SELECT)
    .order("week_start", { ascending: false })
    .order("slot", { ascending: true });
  if (error) throw new Error(`Couldn't load past weeks: ${error.message}`);
  return data as WorkSession[];
}

/** Sets a slot's project and/or goal. Fields left undefined are kept. */
export async function planSession(
  weekStart: string,
  slot: number,
  plan: { project_id?: string | null; goal?: string },
): Promise<WorkSession> {
  checkSlot(weekStart, slot);
  const row: Record<string, unknown> = { week_start: weekStart, slot };
  if (plan.project_id !== undefined) row.project_id = plan.project_id || null;
  if (plan.goal !== undefined) row.goal = plan.goal.trim();
  return upsert(row);
}

/**
 * Ticks a slot done on `doneOn` and marks its project worked on that day
 * (unless the project already has a later date).
 */
export async function completeSession(
  weekStart: string,
  slot: number,
  doneOn: string,
  note?: string,
): Promise<WorkSession> {
  checkSlot(weekStart, slot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doneOn)) {
    throw new Error("Done date must be YYYY-MM-DD.");
  }
  const row: Record<string, unknown> = {
    week_start: weekStart,
    slot,
    done_on: doneOn,
  };
  if (note !== undefined) row.note = note.trim();
  const session = await upsert(row);

  if (session.project_id) {
    const project = await getProject(session.project_id);
    if (project && (!project.last_worked_on || project.last_worked_on < doneOn)) {
      await updateProject(project.id, { last_worked_on: doneOn });
    }
  }
  return session;
}

/** Un-ticks a slot (the project's last-worked date is left alone). */
export function reopenSession(weekStart: string, slot: number) {
  checkSlot(weekStart, slot);
  return upsert({ week_start: weekStart, slot, done_on: null });
}

/** Empties a slot completely. */
export async function clearSession(weekStart: string, slot: number) {
  checkSlot(weekStart, slot);
  const { error } = await db()
    .from("work_sessions")
    .delete()
    .eq("week_start", weekStart)
    .eq("slot", slot);
  if (error) throw new Error(`Couldn't clear session: ${error.message}`);
}

async function upsert(row: Record<string, unknown>): Promise<WorkSession> {
  const { data, error } = await db()
    .from("work_sessions")
    .upsert(row, { onConflict: "week_start,slot" })
    .select(SELECT)
    .single();
  if (error) throw new Error(`Couldn't save session: ${error.message}`);
  return data as WorkSession;
}

function checkSlot(weekStart: string, slot: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new Error("Week must be a date (YYYY-MM-DD).");
  }
  if (!SLOTS.includes(slot as (typeof SLOTS)[number])) {
    throw new Error("Slot must be 1, 2 or 3.");
  }
}
