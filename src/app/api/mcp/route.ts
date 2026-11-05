import { createMcpHandler } from "mcp-handler";
import { connection } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/auth";
import { describeLastWorked, todayISO } from "@/lib/dates";
import {
  STATUSES,
  getProject,
  insertProject,
  listProjects,
  updateProject,
  validateProject,
  type Project,
} from "@/lib/projects";

// MCP endpoint: lets Claude (claude.ai connector, Claude Code, phone app)
// read and edit projects through the same code as the web forms.
//
// Auth: a fixed bearer token (DASHBOARD_MCP_TOKEN), sent by the client as
// "Authorization: Bearer <token>". src/proxy.ts lets this one path skip the
// Basic Auth gate, so this check is the only thing protecting it.
//
// There is deliberately no delete tool, matching the web app.

const id = z.uuid().describe("The project's id, from list_projects.");
const status = z.enum(STATUSES);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("A date as YYYY-MM-DD.");

const mcp = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description:
          "List every project on the dashboard (active first, done/dropped last) with status, stack, next task and when it was last worked on. Call this first to get project ids.",
        annotations: { readOnlyHint: true },
      },
      () =>
        run(async () => {
          const today = todayISO();
          const projects = await listProjects();
          return { today, projects: projects.map((p) => summarise(p, today)) };
        }),
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
  { serverInfo: { name: "project-dashboard", version: "0.1.0" } },
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
