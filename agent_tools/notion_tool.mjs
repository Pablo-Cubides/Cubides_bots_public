import fs from "node:fs";
import path from "node:path";
import { allMappedEntries, loadNotionMap, printMapSummary } from "./notion_map.mjs";

const NOTION_VERSION = "2022-06-28";

function parseArgs(argv) {
  const args = {
    command: argv[2] || "map",
    agent: "",
    alias: "",
    query: "",
    title: "",
    limit: 10,
    pageId: "",
    text: "",
    bodyFile: "",
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--agent") args.agent = argv[++i] || "";
    else if (arg === "--alias") args.alias = argv[++i] || "";
    else if (arg === "--query") args.query = argv[++i] || "";
    else if (arg === "--title") args.title = argv[++i] || "";
    else if (arg === "--limit") args.limit = Number(argv[++i] || args.limit);
    else if (arg === "--page-id") args.pageId = argv[++i] || "";
    else if (arg === "--text") args.text = argv[++i] || "";
    else if (arg === "--body-file") args.bodyFile = argv[++i] || "";
  }
  return args;
}

function tokenFromRuntimeFallback(agent = "") {
  const envFileByAgent = { colega: "colega.env", coach: "personal.env", socio: "business.env" };
  const file = envFileByAgent[agent];
  if (!file) return "";
  const candidates = [
    path.join(process.cwd(), "secrets", "runtime", file),
    path.join(process.cwd(), "..", "secrets", "runtime", file),
    path.join("/home/claude/workspace/secrets/runtime", file),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    for (const line of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("NOTION_API_KEY=")) return trimmed.slice("NOTION_API_KEY=".length);
    }
  }
  return "";
}

function notionToken(agent) {
  return process.env.NOTION_API_KEY || tokenFromRuntimeFallback(agent);
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

function plainTitle(richText = []) {
  return richText.map((item) => item.plain_text || "").join("").trim();
}

function titleOf(item) {
  if (item.object === "database") return plainTitle(item.title) || "(database sin titulo)";
  if (item.object === "page") {
    for (const property of Object.values(item.properties || {})) {
      if (property?.type === "title") return plainTitle(property.title) || "(pagina sin titulo)";
    }
  }
  return "(sin titulo)";
}

function resolveAlias(alias) {
  const map = loadNotionMap();
  const entry = allMappedEntries(map).find((item) => item.alias === alias);
  if (!entry) throw new Error(`Alias no encontrado en config/notion-map.json: ${alias}`);
  return entry;
}

function resolvePageId({ alias = "", pageId = "" }) {
  if (pageId) return pageId;
  if (!alias) throw new Error("Falta --alias o --page-id.");
  const entry = resolveAlias(alias);
  if (entry.kind !== "page") throw new Error(`${alias} no es una pagina. Para registros de database usa su page id directo.`);
  return entry.id;
}

function inputText(args) {
  if (args.bodyFile) {
    if (!fs.existsSync(args.bodyFile)) throw new Error(`No existe --body-file: ${args.bodyFile}`);
    return fs.readFileSync(args.bodyFile, "utf8");
  }
  return args.text || "";
}

function richText(content) {
  return [{ type: "text", text: { content: String(content || "").slice(0, 1900) } }];
}

function textToBlocks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (/^###\s+/.test(line)) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: richText(line.replace(/^###\s+/, "")) } });
    } else if (/^##\s+/.test(line)) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText(line.replace(/^##\s+/, "")) } });
    } else if (/^#\s+/.test(line)) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: richText(line.replace(/^#\s+/, "")) } });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(line.replace(/^[-*]\s+/, "")) } });
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: richText(line.replace(/^\d+\.\s+/, "")) } });
    } else {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: richText(line) } });
    }
  }
  return blocks;
}

async function search(token, query, limit) {
  const body = { page_size: Math.min(Math.max(limit, 1), 100) };
  if (query) body.query = query;
  const response = await notionFetch(token, "/search", { method: "POST", body: JSON.stringify(body) });
  return (response.results || []).map((item) => ({
    object: item.object,
    title: titleOf(item),
    id: item.id,
    url: item.url,
  }));
}

async function createRecord(token, alias, title) {
  const entry = resolveAlias(alias);
  if (entry.kind !== "database") throw new Error(`${alias} no es una database.`);
  if (!title) throw new Error("Falta --title.");
  const database = await notionFetch(token, `/databases/${encodeURIComponent(entry.id)}`);
  const titleProperty = Object.entries(database.properties || {}).find(([, value]) => value?.type === "title");
  if (!titleProperty) throw new Error(`No encontré propiedad title en ${alias}.`);
  const [propertyName] = titleProperty;
  return notionFetch(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: entry.id },
      properties: {
        [propertyName]: { title: [{ text: { content: title } }] },
      },
    }),
  });
}

async function readPage(token, pageId) {
  const page = await notionFetch(token, `/pages/${encodeURIComponent(pageId)}`);
  const children = await notionFetch(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`);
  return {
    id: page.id,
    title: titleOf(page),
    url: page.url,
    archived: page.archived,
    blocks: (children.results || []).map((block) => ({
      id: block.id,
      type: block.type,
      text: plainTitle(block[block.type]?.rich_text || []),
      hasChildren: block.has_children,
    })),
  };
}

async function appendBlocks(token, pageId, text) {
  const blocks = textToBlocks(text);
  if (!blocks.length) throw new Error("No hay texto para agregar. Usa --text o --body-file.");
  const appended = [];
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    const response = await notionFetch(token, `/blocks/${encodeURIComponent(pageId)}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
    appended.push(...(response.results || []));
  }
  return { ok: true, pageId, appended: appended.length };
}

async function archivePage(token, pageId) {
  const response = await notionFetch(token, `/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  return { ok: true, id: response.id, archived: response.archived, url: response.url };
}

const args = parseArgs(process.argv);
const token = notionToken(args.agent);
if (!token && args.command !== "map") {
  console.error("Falta NOTION_API_KEY en el entorno. Ejecuta desde un contenedor/agente con secretos cargados.");
  process.exit(1);
}

if (args.command === "map") {
  console.log(printMapSummary(args.agent));
} else if (args.command === "search") {
  console.log(JSON.stringify(await search(token, args.query, args.limit), null, 2));
} else if (args.command === "create-record") {
  const created = await createRecord(token, args.alias, args.title);
  console.log(JSON.stringify({ ok: true, id: created.id, url: created.url }, null, 2));
} else if (args.command === "read-page") {
  console.log(JSON.stringify(await readPage(token, resolvePageId(args)), null, 2));
} else if (args.command === "append-blocks") {
  const result = await appendBlocks(token, resolvePageId(args), inputText(args));
  console.log(JSON.stringify(result, null, 2));
} else if (args.command === "archive-page") {
  console.log(JSON.stringify(await archivePage(token, resolvePageId(args)), null, 2));
} else {
  console.error("Comando invalido. Usa: map, search, create-record, read-page, append-blocks, archive-page.");
  process.exit(2);
}

