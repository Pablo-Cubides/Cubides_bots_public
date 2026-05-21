import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repoRoot, "logs", "runtime", "colega-memory-bridge");
const sessionRoot = "/data/openclaw/agents/main/sessions";

function todayBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dockerText(args) {
  return execFileSync("docker", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function redact(value = "") {
  return String(value || "")
    .replace(/xox[baprs]-[A-Za-z0-9-]+/g, "[SLACK_TOKEN]")
    .replace(/xapp-[A-Za-z0-9-]+/g, "[SLACK_APP_TOKEN]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[OPENROUTER_KEY]")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[CLAUDE_TOKEN]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[SECRET]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[GOOGLE_KEY]");
}

function stripPromptEnvelope(text = "") {
  return String(text || "")
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/Eres Colega[\s\S]*?Mensaje de Slack:\s*/i, "")
    .replace(/\[\[reply_to_current\]\]\s*/g, "")
    .trim();
}

function collectTexts(value, out = []) {
  if (!value) return out;
  if (typeof value === "string") {
    const clean = stripPromptEnvelope(value);
    if (
      clean &&
      clean.length > 2 &&
      !clean.includes("encrypted_content") &&
      !clean.includes("thinkingSignature") &&
      !clean.includes("textSignature") &&
      !clean.startsWith("gAAAAA")
    ) {
      out.push(clean);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTexts(item, out);
    return out;
  }
  if (typeof value === "object") {
    if (value.type === "thinking" || value.thinkingSignature || value.encrypted_content) return out;
    for (const key of ["text", "content", "message", "reply"]) {
      if (key in value) collectTexts(value[key], out);
    }
  }
  return out;
}

function extractMessage(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const role = parsed?.message?.role || parsed?.role || "";
  if (!["user", "assistant"].includes(role)) return null;
  const texts = collectTexts(parsed?.message?.content ?? parsed?.content ?? parsed?.message).join("\n").trim();
  if (!texts) return null;
  if (
    role === "user" &&
    /^(Rutina nocturna de Colega|Rutina de mañana de Colega|Reuni[oó]n dominical de Colega)\b/i.test(texts)
  ) {
    return null;
  }
  return {
    role,
    timestamp: parsed.timestamp || parsed.ts || "",
    text: redact(texts).slice(0, 1800),
  };
}

function listSessionFiles(days = 3) {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Number(days)) : 3;
  const command = `find ${sessionRoot} -type f -name '*.jsonl' -mtime -${safeDays} ! -name '*.trajectory.jsonl' | sort`;
  return dockerText(["exec", "colega", "sh", "-lc", command])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readSessionTail(file, lines = 250) {
  const safeLines = Number.isFinite(Number(lines)) ? Math.max(20, Number(lines)) : 250;
  const escaped = file.replace(/'/g, "'\\''");
  return dockerText(["exec", "colega", "sh", "-lc", `tail -n ${safeLines} '${escaped}'`]);
}

export function buildColegaNativeMemory({ days = 10, lines = 250 } = {}) {
  const files = listSessionFiles(days);
  const entries = [];
  for (const file of files) {
    const raw = readSessionTail(file, lines);
    for (const line of raw.split(/\r?\n/)) {
      const item = extractMessage(line);
      if (item) entries.push({ ...item, file: path.posix.basename(file) });
    }
  }

  const recent = entries.slice(-80);
  const date = todayBogota();
  const outputPath = path.join(outputRoot, `${date}.md`);
  fs.mkdirSync(outputRoot, { recursive: true });

  const body = [
    `# Puente De Memoria Nativa Colega - ${date}`,
    "",
    "Este archivo resume intercambios recientes de Slack nativo de OpenClaw para que Colega pueda retomar conversaciones y rutinas.",
    "",
    "## Reglas",
    "",
    "- Usar como contexto reciente, no como fuente de secretos.",
    "- Si hay contradicción con IDENTITY.md, SOUL.md o instrucciones directas de Primary User, prevalecen esos archivos/instrucciones.",
    "",
    "## Conversaciones Recientes",
    "",
    ...recent.map((entry) =>
      [`### ${entry.role === "user" ? "Primary User" : "Colega"}${entry.timestamp ? ` - ${entry.timestamp}` : ""}`, "", entry.text, "", `Fuente: ${entry.file}`, ""].join(
        "\n",
      ),
    ),
  ].join("\n");

  fs.writeFileSync(outputPath, body, "utf8");
  return { outputPath, files: files.length, entries: recent.length };
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (executedPath && path.resolve(fileURLToPath(import.meta.url)) === executedPath) {
  const daysArg = process.argv.includes("--days") ? process.argv[process.argv.indexOf("--days") + 1] : process.env.COLEGA_MEMORY_DAYS;
  const result = buildColegaNativeMemory({ days: daysArg ? Number(daysArg) : 10 });
  console.log(JSON.stringify(result, null, 2));
}


