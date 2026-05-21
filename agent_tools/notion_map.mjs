import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export const notionMapPath = firstExisting([
  process.env.NOTION_MAP_PATH,
  path.join(repoRoot, "config", "notion-map.json"),
  path.join(process.cwd(), "config", "notion-map.json"),
  path.join(process.cwd(), "..", "config", "notion-map.json"),
  "/home/claude/workspace/config/notion-map.json",
  "/app/config/notion-map.json",
]);

export function loadNotionMap() {
  if (!fs.existsSync(notionMapPath)) {
    return { pages: {}, databases: {}, groups: {}, agentHints: {} };
  }
  return JSON.parse(fs.readFileSync(notionMapPath, "utf8"));
}

export function allMappedEntries(map = loadNotionMap()) {
  const entries = [];
  for (const [alias, item] of Object.entries(map.pages || {})) {
    entries.push({ alias, kind: "page", ...(item || {}) });
  }
  for (const [alias, item] of Object.entries(map.databases || {})) {
    entries.push({ alias, kind: "database", ...(item || {}) });
  }
  for (const [alias, ids] of Object.entries(map.groups || {})) {
    entries.push({ alias, kind: "group", ids: Array.isArray(ids) ? ids : [] });
  }
  return entries;
}

export function notionMapPromptBlock(agentId = "") {
  const map = loadNotionMap();
  const entries = allMappedEntries(map)
    .filter((item) => item.kind !== "group")
    .filter((item) => item.owner === "shared" || item.owner === agentId)
    .map((item) => `- ${item.alias}: ${item.title} (${item.kind}, ${String(item.id || "").slice(0, 8)}...)`);

  const hints = map.agentHints?.[agentId] || [];
  const lines = [
    "Notion esta disponible mediante el token cifrado ya cargado en runtime.",
    "Usa los aliases canonicos del mapa antes de adivinar bases por nombre.",
    "Herramientas Notion disponibles: map, search, create-record, read-page, append-blocks y archive-page con agent_tools/notion_tool.mjs; dentro de contenedores usa node /opt/agent_tools/notion_tool.mjs.",
    "Para editar cuerpo de paginas usa append-blocks con --alias o --page-id. Para registros mal creados usa archive-page solo si el humano lo pidio o es una correccion clara.",
  ];
  if (entries.length) {
    lines.push("Bases/paginas canonicas relevantes:");
    lines.push(...entries);
  }
  if (hints.length) {
    lines.push("Reglas de uso:");
    lines.push(...hints.map((hint) => `- ${hint}`));
  }
  return lines.join("\n");
}

export function printMapSummary(agentId = "") {
  const map = loadNotionMap();
  const entries = allMappedEntries(map);
  const filtered = agentId
    ? entries.filter((item) => item.owner === "shared" || item.owner === agentId || item.kind === "group")
    : entries;
  return filtered
    .map((item) => {
      if (item.kind === "group") return `${item.alias} [group] ${item.ids.length} ids`;
      return `${item.alias} [${item.kind}] ${item.title} (${item.owner}) ${item.id}`;
    })
    .join("\n");
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const agentArg = process.argv.includes("--agent") ? process.argv[process.argv.indexOf("--agent") + 1] : "";
  console.log(printMapSummary(agentArg));
}

