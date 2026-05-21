import { discoverModels } from "@/lib/models";
import { requireDashboardAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireDashboardAuth(request);
  if (unauthorized) return unauthorized;

  const discovery = await discoverModels(true);
  return Response.json(discovery);
}

