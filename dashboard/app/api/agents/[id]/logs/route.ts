import { agentLogs } from "@/lib/snapshot";
import { requireDashboardAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const unauthorized = requireDashboardAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  return Response.json({ logs: await agentLogs(id) });
}

