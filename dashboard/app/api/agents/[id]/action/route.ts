import { runAgentAction } from "@/lib/shell";
import { requireDashboardAuth } from "@/lib/security";
import type { AgentAction, AgentId } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const agentIds: AgentId[] = ["colega", "coach", "socio"];

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = requireDashboardAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!agentIds.includes(id as AgentId)) {
    return Response.json({ ok: false, error: "Agente no permitido." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: AgentAction };

  if (!body.action) {
    return Response.json({ ok: false, error: "Falta action." }, { status: 400 });
  }

  const result = await runAgentAction(id as AgentId, body.action);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

