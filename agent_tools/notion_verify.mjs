import fs from "node:fs";
import path from "node:path";
import { allMappedEntries, loadNotionMap } from "./notion_map.mjs";

const repoRoot = process.cwd();
const NOTION_VERSION = "2022-06-28";

const AGENTS = {
  colega: "colega.env",
  coach: "personal.env",
  socio: "business.env",
};

const DATABASE_KEYS = [
  "NOTION_TASKS_DATABASE_ID",
  "NOTION_MEMORY_DATABASE_ID",
  "NOTION_DAILY_DATABASE_ID",
  "NOTION_NIGHTLY_DATABASE_ID",
  "NOTION_SUNDAY_DATABASE_ID",
  "NOTION_BUSINESS_METRICS_DATABASE_ID",
];

function parseArgs(argv) {
  const args = { agent: "all", search: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--agent") args.agent = argv[++i] || "all";
    else if (arg === "--search") args.search = true;
  }
  return args;
}

function parseEnv(filePath) {
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

async function notionFetch(token, endpoint, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || body?.code || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }
  return body;
}

async function verifyAgent(agentId, envFile, options) {
  const env = parseEnv(path.join(repoRoot, "secrets", "runtime", envFile));
  const token = env.NOTION_API_KEY;
  const map = loadNotionMap();
  const result = {
    agent: agentId,
    tokenPresent: Boolean(token),
    auth: "not_checked",
    botName: "",
    databases: {},
    mapped: {},
    searchVisible: null,
    errors: [],
  };

  if (!token) {
    result.auth = "missing_token";
    return result;
  }

  try {
    const me = await notionFetch(token, "/users/me");
    result.auth = "ok";
    result.botName = me?.bot?.owner?.workspace_name || me?.name || "notion-bot";
  } catch (error) {
    result.auth = "failed";
    result.errors.push(`auth: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  for (const key of DATABASE_KEYS) {
    const id = env[key];
    if (!id) {
      result.databases[key] = "missing";
      continue;
    }
    try {
      await notionFetch(token, `/databases/${encodeURIComponent(id)}`);
      result.databases[key] = "ok";
    } catch (error) {
      result.databases[key] = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  for (const item of allMappedEntries(map)) {
    if (item.kind !== "group" && item.owner && item.owner !== "shared" && item.owner !== agentId) continue;
    if (item.kind === "group") {
      const checks = [];
      for (const id of item.ids || []) {
        try {
          await notionFetch(token, `/databases/${encodeURIComponent(id)}`);
          checks.push("ok");
        } catch (error) {
          checks.push(`failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const failed = checks.filter((value) => value !== "ok");
      result.mapped[item.alias] = failed.length === 0 ? `ok (${checks.length})` : `partial (${checks.length - failed.length}/${checks.length})`;
      continue;
    }

    try {
      const endpoint = item.kind === "page" ? `/pages/${encodeURIComponent(item.id)}` : `/databases/${encodeURIComponent(item.id)}`;
      await notionFetch(token, endpoint);
      result.mapped[item.alias] = "ok";
    } catch (error) {
      result.mapped[item.alias] = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (options.search) {
    try {
      const search = await notionFetch(token, "/search", {
        method: "POST",
        body: JSON.stringify({ page_size: 10 }),
      });
      result.searchVisible = Array.isArray(search.results) ? search.results.length : 0;
    } catch (error) {
      result.searchVisible = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return result;
}

const args = parseArgs(process.argv);
const targets = args.agent === "all" ? Object.entries(AGENTS) : [[args.agent, AGENTS[args.agent]]];
if (targets.some(([, envFile]) => !envFile)) {
  console.error("Agente invalido. Usa: colega, coach, socio o all.");
  process.exit(2);
}

const results = [];
for (const [agentId, envFile] of targets) {
  results.push(await verifyAgent(agentId, envFile, args));
}

console.log(JSON.stringify(results, null, 2));

