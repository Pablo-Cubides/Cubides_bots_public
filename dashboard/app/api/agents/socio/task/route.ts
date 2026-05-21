import { agentAdminToken } from "@/lib/env";
import { requireDashboardAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireDashboardAuth(request);
  if (unauthorized) return unauthorized;

  const token = agentAdminToken();
  if (!token) {
    return Response.json({ ok: false, error: "AGENT_ADMIN_TOKEN no configurado." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { task?: string };
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) {
    return Response.json({ ok: false, error: "La tarea no puede estar vacia." }, { status: 400 });
  }

  const response = await fetch("http://127.0.0.1:8003/api/task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Admin-Token": token,
    },
    body: JSON.stringify({ task }),
  });

  const payload = await response.json().catch(() => ({}));
  return Response.json({ ok: response.ok, payload }, { status: response.ok ? 200 : response.status });
}

