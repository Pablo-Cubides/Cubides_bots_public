import { discoverModels } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const discovery = await discoverModels(false);
  return Response.json(discovery);
}


