import { dashboardToken } from "./env";
import { timingSafeEqual } from "node:crypto";

const SECRET_PATTERNS = [
  /(sk-[A-Za-z0-9_-]{16,})/g,
  /(Bearer\s+)[A-Za-z0-9._-]+/gi,
  /(CLAUDE_CODE_OAUTH_TOKEN=)[^\s]+/g,
  /(OPENROUTER_API_KEY=)[^\s]+/g,
  /(OPENCLAW_GATEWAY_TOKEN=)[^\s]+/g,
  /(AGENT_ADMIN_TOKEN=)[^\s]+/g,
  /(VNC_PASSWORD=)[^\s]+/g,
  /((?:GMAIL_BOT|COACH_GMAIL|SOCIO_GMAIL)_APP_PASSWORD=)[^\s]+/g,
];

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, (_match, prefix = "") => `${prefix}[REDACTED]`), text);
}

export function requireDashboardAuth(request: Request): Response | null {
  const expected = dashboardToken();
  if (!expected) {
    return Response.json(
      {
        ok: false,
        error: "Token administrativo no configurado. Define DASHBOARD_ADMIN_TOKEN o AGENT_ADMIN_TOKEN.",
      },
      { status: 503 },
    );
  }
  const actual = request.headers.get("x-dashboard-admin-token") || "";
  if (safeEquals(actual, expected)) return null;
  return Response.json({ ok: false, error: "Token administrativo invalido" }, { status: 401 });
}

function safeEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}


