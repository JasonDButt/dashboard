import { connection } from "next/server";
import { db } from "./supabase";
import { getProject, updateProject } from "./projects";

// The weekly view: flexible session slots per week (no fixed days). Every week
// shows 3; "Add session" adds more, up to MAX_SLOTS. A slot's row is created
// the first time it's planned, added or ticked done.

export const DEFAULT_SLOTS = 3;
export const MAX_SLOTS = 14; // keep in sync with the check in schema.sql

/** Weekly hours target (from the plan: ~4 hrs x 3 sessions). */
export const WEEKLY_HOURS_TARGET =
  Number(process.env.DASHBOARD_WEEKLY_HOURS) || 12;

export type WorkSession = {
  id: string;
  week_start: string; // the Monday, YYYY-MM-DD
  slot: number; // 1 to MAX_SLOTS
  project_id: string | null;
  goal: string;
  done_on: string | null; // YYYY-MM-DD
  note: string;
  hours: number | null; // time spent; only counted once done
  created_at: string;
  updated_at: string;
  project: { name: string } | null; // joined from projects
};

const SELECT = "*, project:projects(name)";

/**
 * A week's slots in order (index 0 = slot 1): at least DEFAULT_SLOTS, more if
 * sessions were added. null where a slot hasn't been used yet.
 */
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
  const count = Math.max(DEFAULT_SLOTS, ...rows.map((r) => r.slot));
  return Array.from(
    { length: count },
    (_, i) => rows.find((r) => r.slot === i + 1) ?? null,
  );
}

/**
 * Adds an empty session slot after the week's last one; returns its number.
 * With `expectedCount` (how many sessions the page showed), does nothing and
 * returns null if the week has changed since, e.g. on a double click.
 */
export async function addSession(
  weekStart: string,
  expectedCount?: number,
): Promise<number | null> {
  const count = (await getWeek(weekStart)).length;
  if (expectedCount !== undefined && count !== expectedCount) return null;
  const slot = count + 1;
  if (slot > MAX_SLOTS) {
    throw new Error(`A week can have at most ${MAX_SLOTS} sessions.`);
  }
  await upsert({ week_start: weekStart, slot });
  return slot;
}

/**
 * Takes an empty session out of the week and moves every later one down a
 * number (remove 5 of 6: old 6 becomes 5). Only when the week has more than
 * DEFAULT_SLOTS, so the first 3 always remain. With `expectedCount` (how many
 * sessions the page showed), does nothing if the week has changed since: on a
 * double click, the second click would otherwise remove the next session too.
 */
export async function removeSession(
  weekStart: string,
  slot: number,
  expectedCount?: number,
) {
  checkSlot(weekStart, slot);
  const week = await getWeek(weekStart);
  if (expectedCount !== undefined && week.length !== expectedCount) return;
  if (week.length <= DEFAULT_SLOTS) {
    throw new Error(`A week always keeps ${DEFAULT_SLOTS} sessions.`);
  }
  const session = week[slot - 1];
  if (session && !isEmpty(session)) {
    throw new Error("Clear the session before removing it.");
  }

  await clearSession(weekStart, slot);
  // Shift later sessions down one at a time, lowest first, so each move goes
  // into a number that's already free (slot numbers are unique per week).
  for (const later of week.slice(slot)) {
    if (!later) continue;
    const { error } = await db()
      .from("work_sessions")
      .update({ slot: later.slot - 1 })
      .eq("id", later.id);
    if (error) throw new Error(`Couldn't renumber sessions: ${error.message}`);
  }
}

/** Nothing planned, done or logged (hours count, even before it's done). */
export function isEmpty(session: WorkSession | null): boolean {
  return (
    !session ||
    (!session.project_id && !session.goal && !session.done_on && session.hours == null)
  );
}

/**
 * For Claude: a slot number past the end of the week (which would leave empty
 * sessions in between) becomes the next new session instead.
 */
export async function fitSlot(weekStart: string, slot: number): Promise<number> {
  checkSlot(weekStart, slot);
  const next = (await getWeek(weekStart)).length + 1;
  return Math.min(slot, next);
}

/** Number of slots a week shows, given its rows (e.g. for /weeks). */
export function slotCount(rows: WorkSession[]): number {
  return Math.max(DEFAULT_SLOTS, ...rows.map((r) => r.slot));
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
  hours?: number | null,
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
  if (hours !== undefined) row.hours = checkHours(hours);
  const session = await upsert(row);

  if (session.project_id) {
    const project = await getProject(session.project_id);
    if (project && (!project.last_worked_on || project.last_worked_on < doneOn)) {
      await updateProject(project.id, { last_worked_on: doneOn });
    }
  }
  return session;
}

/** Sets (or with null, clears) the hours logged for a slot. */
export function logHours(weekStart: string, slot: number, hours: number | null) {
  checkSlot(weekStart, slot);
  return upsert({ week_start: weekStart, slot, hours: checkHours(hours) });
}

/** Hours from done sessions, summed. */
export function totalHours(sessions: (WorkSession | null)[]): number {
  return sessions.reduce(
    (sum, s) => sum + (s?.done_on && s.hours ? Number(s.hours) : 0),
    0,
  );
}

/** All-time hours from done sessions, per project id. */
export async function hoursByProject(): Promise<Map<string, number>> {
  await connection();
  const { data, error } = await db()
    .from("work_sessions")
    .select("project_id, hours")
    .not("done_on", "is", null)
    .not("project_id", "is", null)
    .not("hours", "is", null);
  if (error) throw new Error(`Couldn't load hours: ${error.message}`);
  const totals = new Map<string, number>();
  for (const r of data as { project_id: string; hours: number }[]) {
    totals.set(r.project_id, (totals.get(r.project_id) ?? 0) + Number(r.hours));
  }
  return totals;
}

/**
 * Reads an hours form field: "" means not given (null), otherwise a number
 * from 0 to 24 ("3.5", "3,5" and "3h" all work).
 */
export function parseHours(raw: unknown): number | null {
  const text = String(raw ?? "")
    .trim()
    .replace(",", ".")
    .replace(/\s*(h|hrs?|hours?)$/i, "");
  if (!text) return null;
  return checkHours(Number(text));
}

/** "3.5 hrs", "1 hr". */
export function formatHours(hours: number): string {
  const n = Math.round(hours * 100) / 100;
  return `${n} ${n === 1 ? "hr" : "hrs"}`;
}

function checkHours(hours: number | null): number | null {
  if (hours === null) return null;
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    throw new Error("Hours must be a number from 0 to 24.");
  }
  return Math.round(hours * 100) / 100;
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
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) {
    throw new Error(`Slot must be from 1 to ${MAX_SLOTS}.`);
  }
}
