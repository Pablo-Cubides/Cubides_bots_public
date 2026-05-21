import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");

const runtimeDir = path.join(repoRoot, "logs", "runtime");
const conversationDir = path.join(runtimeDir, "agent-conversations");
const routeDir = path.join(runtimeDir, "slack-routes");
const businessRouteFile = path.join(repoRoot, "business_agent", "data", ".agent", "state", "slack-route.json");

fs.mkdirSync(conversationDir, { recursive: true });
fs.mkdirSync(routeDir, { recursive: true });

const MAX_JSONL_BYTES = 1024 * 1024 * 2;

function safeAgentId(agentId) {
  return String(agentId || "unknown").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

function conversationPath(agentId) {
  return path.join(conversationDir, `${safeAgentId(agentId)}.jsonl`);
}

function rotateIfNeeded(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.size <= MAX_JSONL_BYTES) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const tail = lines.slice(-500);
  fs.writeFileSync(filePath, `${tail.join("\n")}\n`, "utf8");
}

export function appendConversation(agentId, record) {
  const filePath = conversationPath(agentId);
  rotateIfNeeded(filePath);
  const clean = {
    timestamp: new Date().toISOString(),
    agentId: safeAgentId(agentId),
    source: "slack",
    direction: "unknown",
    role: "unknown",
    text: "",
    ...record,
  };
  fs.appendFileSync(filePath, `${JSON.stringify(clean)}\n`, "utf8");
}

export function readRecentConversation(agentId, options = {}) {
  const filePath = conversationPath(agentId);
  if (!fs.existsSync(filePath)) return [];

  const limit = Number.isFinite(options.limit) ? options.limit : 12;
  const channel = options.channel ? String(options.channel) : "";
  const user = options.user ? String(options.user) : "";
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const records = [];

  for (const line of lines.slice(-300)) {
    try {
      const record = JSON.parse(line);
      if (channel && record.channel && record.channel !== channel) continue;
      if (user && record.user && record.user !== user) continue;
      records.push(record);
    } catch {
      // Ignore corrupt local log lines.
    }
  }

  return records.slice(-limit);
}

export function formatRecentConversation(agentId, options = {}) {
  const records = readRecentConversation(agentId, options);
  if (records.length === 0) {
    return "Historial reciente: sin intercambios registrados en memoria local.";
  }

  const lines = records.map((record) => {
    const who = record.role === "assistant" ? record.agentName || agentId : "Primary User/Primary User";
    const stamp = record.timestamp || "";
    const routine = record.routine ? ` [${record.routine}]` : "";
    const text = String(record.text || "").replace(/\s+/g, " ").trim();
    return `- ${stamp}${routine} ${who}: ${text.slice(0, 900)}`;
  });

  return ["Historial reciente de Slack/memoria local:", ...lines].join("\n");
}

export function saveLastSlackRoute(agentId, route) {
  const cleanRoute = {
    agentId: safeAgentId(agentId),
    channel: route.channel || "",
    user: route.user || "",
    thread_ts: route.thread_ts || "",
    updatedAt: new Date().toISOString(),
  };
  const filePath = path.join(routeDir, `${safeAgentId(agentId)}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cleanRoute, null, 2), "utf8");

  if (safeAgentId(agentId) === "socio") {
    fs.mkdirSync(path.dirname(businessRouteFile), { recursive: true });
    fs.writeFileSync(businessRouteFile, JSON.stringify(cleanRoute, null, 2), "utf8");
  }
}

export function readLastSlackRoute(agentId) {
  const filePath = path.join(routeDir, `${safeAgentId(agentId)}.json`);
  if (!fs.existsSync(filePath)) return legacySlackRoute(agentId);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return legacySlackRoute(agentId);
  }
}

function legacyInboxPath(agentId) {
  const id = safeAgentId(agentId);
  if (id === "colega") return path.join(repoRoot, "academic_agent", "profile", "inbox", "slack.md");
  if (id === "coach") return path.join(repoRoot, "personal_agent", "inbox", "slack.md");
  if (id === "socio") return path.join(repoRoot, "business_agent", "data", "tasks", "task_plan.md");
  return "";
}

function legacySlackRoute(agentId) {
  const filePath = legacyInboxPath(agentId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const matches = Array.from(text.matchAll(/slack:([A-Z0-9]+):([A-Z0-9]+)/g));
  const last = matches.at(-1);
  if (!last) return null;
  const route = {
    agentId: safeAgentId(agentId),
    channel: last[1],
    user: last[2],
    thread_ts: "",
    updatedAt: new Date().toISOString(),
    source: "legacy-inbox",
  };
  try {
    saveLastSlackRoute(agentId, route);
  } catch {
    // Best effort cache.
  }
  return route;
}

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    env[trimmed.slice(0, index).replace(/^\uFEFF/, "")] = trimmed.slice(index + 1);
  }
  return env;
}

export function resolveSlackChannel(agentId, env = {}) {
  if (env.SLACK_CHANNEL_ID) return env.SLACK_CHANNEL_ID;
  const route = readLastSlackRoute(agentId);
  return route?.channel || "";
}

