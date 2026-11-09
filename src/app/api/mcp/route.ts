import { createMcpHandler } from "mcp-handler";
import { connection } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/auth";
import { describeLastWorked, todayISO, weekStartOf } from "@/lib/dates";
import {
  SLOTS,
  WEEKLY_HOURS_TARGET,
  completeSession,
  getWeek,
  hoursByProject,
  logHours,
  planSession,
  totalHours,
  type WorkSession,
} from "@/lib/sessions";
import {
  getIdea,
  insertIdea,
  listIdeas,
  promoteIdea,
  updateIdea,
  validateIdea,
} from "@/lib/ideas";
import {
  STATUSES,
  getProject,
  insertProject,
  listArchivedProjects,
  listProjects,
  setArchived,
  updateProject,
  validateProject,
  type Project,
} from "@/lib/projects";

// MCP endpoint: lets Claude (claude.ai connector, Claude Code, phone app)
// read and edit projects, the weekly sessions and the idea backlog through
// the same code as the web forms.
//
// Auth: a fixed bearer token (DASHBOARD_MCP_TOKEN), sent by the client as
// "Authorization: Bearer <token>". src/proxy.ts lets this one path skip the
// Basic Auth gate, so this check is the only thing protecting it.
//
// There is deliberately no delete tool: deleting is only for the human, on the
// web pages behind the login. Claude can archive and restore instead.

const id = z.uuid().describe("The project's id, from list_projects.");
const ideaId = z.uuid().describe("The idea's id, from list_ideas.");
const status = z.enum(STATUSES);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("A date as YYYY-MM-DD.");
const slot = z.number().int().min(1).max(3).describe("Session slot, 1-3.");
const hours = z.number().min(0).max(24).describe("Hours spent, e.g. 3.5.");
const weekOf = date
  .optional()
  .describe("Any date in the week (YYYY-MM-DD). Defaults to this week.");

const mcp = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description:
          "List every project on the dashboard except archived ones (active first, done last) with status, stack, next task, when it was last worked on and total hours logged. Call this first to get project ids.",
        annotations: { readOnlyHint: true },
      },
      () =>
        run(async () => {
          const today = todayISO();
          const [projects, hours] = await Promise.all([
            listProjects(),
            hoursByProject(),
          ]);
          return {
            today,
            projects: projects.map((p) => ({
              ...summarise(p, today),
              total_hours: hours.get(p.id) ?? 0,
            })),
          };
        }),
    );

    server.registerTool(
      "list_archived_projects",
      {
        title: "List archived projects",
        description:
          "List archived projects, most recently archived first. Use this to find the id of a project to restore.",
        annotations: { readOnlyHint: true },
      },
      () =>
        run(async () => {
          const today = todayISO();
          const projects = await listArchivedProjects();
          return projects.map((p) => summarise(p, today));
        }),
    );

    server.registerTool(
      "archive_project",
      {
        title: "Archive project",
        description:
          "Move a project off the main list and into the archive. Its status and details are kept, and restore_project brings it back.",
        inputSchema: z.object({ id }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      ({ id }) =>
        run(async () => summarise(await setArchived(id, true), todayISO())),
    );

    server.registerTool(
      "restore_project",
      {
        title: "Restore project",
        description: "Move an archived project back onto the main list.",
        inputSchema: z.object({ id }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      ({ id }) =>
        run(async () => summarise(await setArchived(id, false), todayISO())),
    );

    // --- Weekly view: 3 flexible session slots per week ---

    server.registerTool(
      "get_week",
      {
        title: "Get week",
        description:
          "Show a week's 3 session slots (project, goal, done date, note, hours) and hours logged against the weekly target. Defaults to this week; pass any date to see the week containing it. Weeks start on Monday.",
        inputSchema: z.object({ week_of: weekOf }),
        annotations: { readOnlyHint: true },
      },
      ({ week_of }) =>
        run(async () => {
          const weekStart = resolveWeek(week_of);
          const slots = await getWeek(weekStart);
          return {
            today: todayISO(),
            week_start: weekStart,
            hours_logged: totalHours(slots),
            hours_target: WEEKLY_HOURS_TARGET,
            slots: SLOTS.map((slot, i) => describeSlot(slot, slots[i])),
          };
        }),
    );

    server.registerTool(
      "plan_session",
      {
        title: "Plan session",
        description:
          "Set which project a session slot is for and/or its goal. Only the fields you pass are changed; pass project_id: null to unset the project.",
        inputSchema: z.object({
          slot,
          project_id: id.nullable().optional(),
          goal: z.string().optional(),
          week_of: weekOf,
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      ({ slot, project_id, goal, week_of }) =>
        run(async () =>
          describeSlot(
            slot,
            await planSession(resolveWeek(week_of), slot, { project_id, goal }),
          ),
        ),
    );

    server.registerTool(
      "complete_session",
      {
        title: "Complete session",
        description:
          "Tick a session slot done (today by default) with an optional note and hours spent. Also marks its project as worked on that day. Just after midnight, pass done_on explicitly.",
        inputSchema: z.object({
          slot,
          note: z.string().optional(),
          hours: hours.optional(),
          done_on: date.optional(),
          week_of: weekOf,
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      ({ slot, note, hours, done_on, week_of }) =>
        run(async () => {
          const doneOn = done_on ?? todayISO();
          return describeSlot(
            slot,
            await completeSession(
              resolveWeek(week_of ?? doneOn),
              slot,
              doneOn,
              note,
              hours,
            ),
          );
        }),
    );

    server.registerTool(
      "log_hours",
      {
        title: "Log hours",
        description:
          "Set the hours spent in a session slot (or null to clear them). Hours count toward the weekly target once the session is done.",
        inputSchema: z.object({
          slot,
          hours: hours.nullable(),
          week_of: weekOf,
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      ({ slot, hours, week_of }) =>
        run(async () =>
          describeSlot(slot, await logHours(resolveWeek(week_of), slot, hours)),
        ),
    );

    // --- Idea backlog (no delete tool: deleting ideas is web-only too) ---

    server.registerTool(
      "list_ideas",
      {
        title: "List ideas",
        description: "List the idea backlog, newest first.",
        annotations: { readOnlyHint: true },
      },
      () => run(() => listIdeas()),
    );

    server.registerTool(
      "add_idea",
      {
        title: "Add idea",
        description: "Park a new idea in the backlog.",
        inputSchema: z.object({
          title: z.string().min(1),
          notes: z.string().optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      (input) => run(async () => insertIdea(validateIdea(input))),
    );

    server.registerTool(
      "update_idea",
      {
        title: "Update idea",
        description: "Change an idea's title and/or notes.",
        inputSchema: z.object({
          id: ideaId,
          title: z.string().min(1).optional(),
          notes: z.string().optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      ({ id, ...changes }) =>
        run(async () => {
          const current = await getIdea(id);
          if (!current) throw new Error(`No idea with id ${id}.`);
          return updateIdea(id, validateIdea({ ...current, ...changes }));
        }),
    );

    server.registerTool(
      "promote_idea",
      {
        title: "Promote idea",
        description:
          "Turn a backlog idea into a project (status idea; its notes become the next task). The idea leaves the backlog.",
        inputSchema: z.object({ id: ideaId }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      ({ id }) =>
        run(async () => summarise(await promoteIdea(id), todayISO())),
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description: "Get one project by id.",
        inputSchema: z.object({ id }),
        annotations: { readOnlyHint: true },
      },
      ({ id }) =>
        run(async () => {
          const project = await getProject(id);
          if (!project) throw new Error(`No project with id ${id}.`);
          return summarise(project, todayISO());
        }),
    );

    server.registerTool(
      "add_project",
      {
        title: "Add project",
        description:
          "Add a new project. Only name is required; status defaults to idea.",
        inputSchema: z.object({
          name: z.string().min(1),
          status: status.optional(),
          stack: z.string().optional(),
          next_task: z.string().optional(),
          last_worked_on: date.optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      (input) =>
        run(async () =>
          summarise(await insertProject(validateProject(input)), todayISO()),
        ),
    );

    server.registerTool(
      "update_project",
      {
        title: "Update project",
        description:
          "Change any of a project's fields. Only the fields you pass are changed. Pass last_worked_on: null to clear it.",
        inputSchema: z.object({
          id,
          name: z.string().min(1).optional(),
          status: status.optional(),
          stack: z.string().optional(),
          next_task: z.string().optional(),
          last_worked_on: date.nullable().optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      ({ id, ...changes }) =>
        run(async () => {
          const current = await getProject(id);
          if (!current) throw new Error(`No project with id ${id}.`);
          // Merge, then validate the whole project with the form rules.
          const merged = validateProject({ ...current, ...changes });
          return summarise(await updateProject(id, merged), todayISO());
        }),
    );

    server.registerTool(
      "mark_worked_today",
      {
        title: "Mark worked today",
        description:
          "Set a project's last-worked-on date to today (in the dashboard's time zone), like the 'Worked today' button.",
        inputSchema: z.object({ id }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      ({ id }) =>
        run(async () => {
          const today = todayISO();
          return summarise(
            await updateProject(id, { last_worked_on: today }),
            today,
          );
        }),
    );
  },
  { serverInfo: { name: "project-dashboard", version: "0.2.0" } },
);

async function handler(request: Request): Promise<Response> {
  // Run per request, never prerendered at build (Cache Components).
  await connection();

  const expected = process.env.DASHBOARD_MCP_TOKEN;
  if (!expected) {
    return new Response("DASHBOARD_MCP_TOKEN is not set.", { status: 503 });
  }
  // "Bearer" is case-insensitive per the HTTP spec; a bare token is accepted
  // too, since connector UIs differ in what they expect you to type.
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^bearer\s+/i, "").trim();
  if (!token || !safeEqual(token, expected)) {
    // Shows up in Vercel's logs to diagnose connector setup. Never log the
    // token itself, only its shape.
    console.warn("[mcp] refused", {
      method: request.method,
      hasHeader: header !== "",
      bearerPrefix: /^bearer\s+/i.test(header),
      tokenLength: token.length,
      expectedLength: expected.length,
      userAgent: request.headers.get("user-agent"),
    });
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="dashboard-mcp"' },
    });
  }

  return mcp(request);
}

export { handler as GET, handler as POST, handler as DELETE };

/** Project as Claude sees it: the row plus a human "last worked" phrase. */
function summarise(p: Project, today: string) {
  return { ...p, last_worked: describeLastWorked(p.last_worked_on, today) };
}

/** The Monday of the week containing `date` (default: today). */
function resolveWeek(date?: string) {
  return weekStartOf(date ?? todayISO());
}

/** A slot as Claude sees it, including empty ones. */
function describeSlot(slot: number, s: WorkSession | null) {
  if (!s) return { slot, empty: true };
  return {
    slot,
    project_id: s.project_id,
    project_name: s.project?.name ?? null,
    goal: s.goal,
    done_on: s.done_on,
    note: s.note,
    hours: s.hours === null ? null : Number(s.hours),
  };
}

/** Runs a tool body; returns its result as JSON, or the error as a tool error. */
async function run(body: () => Promise<unknown>) {
  try {
    const result = await body();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [
        { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
      ],
      isError: true,
    };
  }
}
