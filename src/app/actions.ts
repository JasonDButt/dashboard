"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  insertProject,
  parseProjectForm,
  removeProject,
  setArchived,
  updateProject,
} from "@/lib/projects";
import {
  clearSession as clearSlot,
  completeSession as completeSlot,
  planSession as planSlot,
  reopenSession as reopenSlot,
} from "@/lib/sessions";
import {
  insertIdea,
  promoteIdea as promote,
  removeIdea,
  validateIdea,
} from "@/lib/ideas";
import { todayISO } from "@/lib/dates";

// Every request (including these actions) has already passed the password
// check in src/proxy.ts.

export async function createProject(form: FormData) {
  await insertProject(parseProjectForm(form));
  revalidatePath("/");
  redirect("/");
}

export async function saveProject(id: string, form: FormData) {
  await updateProject(id, parseProjectForm(form));
  revalidatePath("/");
  redirect("/");
}

export async function markWorkedToday(id: string) {
  await updateProject(id, { last_worked_on: todayISO() });
  revalidatePath("/");
}

export async function archiveProject(id: string) {
  await setArchived(id, true);
  revalidatePath("/");
  revalidatePath("/archive");
  redirect("/");
}

export async function restoreProject(id: string) {
  await setArchived(id, false);
  revalidatePath("/");
  revalidatePath("/archive");
  redirect("/archive");
}

export async function deleteProject(id: string) {
  const deleted = await removeProject(id);
  revalidatePath("/");
  revalidatePath("/archive");
  redirect(deleted.archived_at ? "/archive" : "/");
}

// Weekly slots. weekStart is bound when the page renders, so a form loaded on
// Sunday night still saves into that week.

export async function planSession(weekStart: string, slot: number, form: FormData) {
  await planSlot(weekStart, slot, {
    project_id: String(form.get("project_id") ?? ""),
    goal: String(form.get("goal") ?? ""),
  });
  refreshWeek();
}

export async function completeSession(
  weekStart: string,
  slot: number,
  form: FormData,
) {
  await completeSlot(weekStart, slot, todayISO(), String(form.get("note") ?? ""));
  refreshWeek();
}

export async function reopenSession(weekStart: string, slot: number) {
  await reopenSlot(weekStart, slot);
  refreshWeek();
}

export async function clearSession(weekStart: string, slot: number) {
  await clearSlot(weekStart, slot);
  refreshWeek();
}

function refreshWeek() {
  revalidatePath("/");
  revalidatePath("/weeks");
}

// Idea backlog.

export async function addIdea(form: FormData) {
  await insertIdea(validateIdea(Object.fromEntries(form)));
  revalidatePath("/");
}

export async function promoteIdea(id: string) {
  const project = await promote(id);
  revalidatePath("/");
  redirect(`/projects/${project.id}`); // to tidy up its details
}

export async function deleteIdea(id: string) {
  await removeIdea(id);
  revalidatePath("/");
}
