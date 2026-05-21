import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const NOTION_VERSION = "2022-06-28";

const AGENTS = {
  colega: "colega.env",
  coach: "personal.env",
  socio: "business.env",
};

function parseArgs(argv) {
  const args = { agent: "coach", type: "all", limit: 100, format: "table" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--agent") args.agent = argv[++i] || args.agent;
    else if (arg === "--type") args.type = argv[++i] || args.type;
    else if (arg === "--limit") args.limit = Number(argv[++i] || args.limit);
    else if (arg === "--json") args.format = "json";
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

function plainTitle(richText = []) {
  return richText.map((item) => item.plain_text || "").join("").trim();
}

function resourceTitle(item) {
  if (item.object === "database") return plainTitle(item.title) || "(database sin titulo)";
  if (item.object === "page") {
    const properties = item.properties || {};
    for (const property of Object.values(properties)) {
      if (property?.type === "title") return plainTitle(property.title) || "(pagina sin titulo)";
    }
    return "(pagina sin titulo)";
  }
  return "(sin titulo)";
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

async function listResources({ token, type, limit }) {
  const results = [];
  let cursor = undefined;
  while (results.length < limit) {
    const body = {
      page_size: Math.min(100, limit - results.length),
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    if (type === "database" || type === "page") {
      body.filter = { property: "object", value: type };
    }

    const response = await notionFetch(token, "/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const item of response.results || []) {
      results.push({
        object: item.object,
        title: resourceTitle(item),
        id: item.id,
        url: item.url,
        archived: Boolean(item.archived),
      });
      if (results.length >= limit) break;
    }

    if (!response.has_more || !response.next_cursor) break;
    cursor = response.next_cursor;
  }
  return results;
}

const args = parseArgs(process.argv);
const envFile = AGENTS[args.agent];
if (!envFile) {
  console.error("Agente invalido. Usa: colega, coach o socio.");
  process.exit(2);
}
if (!["all", "database", "page"].includes(args.type)) {
  console.error("Tipo invalido. Usa: all, database o page.");
  process.exit(2);
}

const env = parseEnv(path.join(repoRoot, "secrets", "runtime", envFile));
const token = env.NOTION_API_KEY;
if (!token) {
  console.error(`Falta NOTION_API_KEY en secrets/runtime/${envFile}.`);
  process.exit(1);
}

const resources = await listResources({ token, type: args.type, limit: args.limit });
if (args.format === "json") {
  console.log(JSON.stringify(resources, null, 2));
} else {
  console.log(`Recursos Notion visibles para ${args.agent} (${resources.length}):`);
  for (const item of resources) {
    console.log(`- [${item.object}] ${item.title}`);
    console.log(`  id: ${item.id}`);
    console.log(`  url: ${item.url}`);
  }
}


