"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { insertProject, parseProjectForm, updateProject } from "@/lib/projects";
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
