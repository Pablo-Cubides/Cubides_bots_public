import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const bridgeDir = path.join(repoRoot, "logs", "runtime", "colega-memory-bridge");
const conversationDir = path.join(repoRoot, "logs", "runtime", "agent-conversations");

fs.mkdirSync(bridgeDir, { recursive: true });

function todayBogota(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function updateColegaMemoryBridge(extraRecords = []) {
  const dateKey = todayBogota();
  const filePath = path.join(bridgeDir, `${dateKey}.md`);
  const records = [
    ...readJsonl(path.join(conversationDir, "colega.jsonl")),
    ...extraRecords,
  ].filter((record) => {
    if (!record?.timestamp) return false;
    return String(record.timestamp).startsWith(dateKey);
  });

  const lines = [
    `# Memoria Puente Colega — ${dateKey}`,
    "",
    "Este archivo resume el contexto diario que debe compartir Slack, rutinas OpenClaw y sesiones web.",
    "Reglas: leer este archivo antes de responder preguntas como \"qué hablamos hoy\" o antes de la rutina de mañana/noche.",
    "",
    "## Interacciones Del Día",
  ];

  if (records.length === 0) {
    lines.push("- Sin registros locales del bridge para hoy. Si hubo conversación nativa en OpenClaw, revisar sesiones internas de OpenClaw.");
  } else {
    for (const record of records.slice(-80)) {
      const who = record.role === "assistant" ? "Colega" : "Primary User";
      const text = String(record.text || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      lines.push(`- ${record.timestamp} — ${who}: ${text.slice(0, 900)}`);
    }
  }

  lines.push(
    "",
    "## Pendientes De Consolidación",
    "- Si Primary User corrige una prioridad vieja, actualizar memoria procedural de OpenClaw.",
    "- Si se decide una URL/proyecto/convocatoria, guardarla aquí y en memoria estable.",
    "- No repetir bloqueos ya resueltos sin verificar el estado actual.",
    "",
  );

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const filePath = updateColegaMemoryBridge();
  console.log(filePath);
}


