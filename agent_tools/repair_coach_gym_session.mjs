import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const notionVersion = "2022-06-28";
const gymDatabaseId = "26f6cee2-f21e-815b-a217-c6be1e2e6ce4";

const sessions = {
  "2026-05-17": [
    { exercise: "Seated leg press", series: "4", reps: "12", weight: "230", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Hip adduction", series: "4", reps: "12", weight: "145", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Leg extension", series: "4", reps: "12", weight: "57.5", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Calf extension", series: "4", reps: "12", weight: "130", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Glute", series: "4", reps: "12", weight: "114", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Seated legs curl up", series: "4", reps: "12", weight: "85", notes: "Registrado desde Slack; peso reportado sin unidad." },
    { exercise: "Scaling machine", series: "1", reps: "10 minutes", weight: "101 calories", notes: "Cardio registrado desde Slack." },
  ],
};

function parseArgs(argv) {
  const args = { date: "", apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--date") args.date = argv[++i] || "";
    else if (argv[i] === "--apply") args.apply = true;
  }
  return args;
}

function loadEnvToken() {
  const candidates = [
    path.join(repoRoot, "secrets", "runtime", "personal.env"),
    path.join(process.cwd(), "secrets", "runtime", "personal.env"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const lines = fs.readFileSync(candidate, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("NOTION_API_KEY=")) return line.slice("NOTION_API_KEY=".length).trim();
    }
  }
  return process.env.NOTION_API_KEY || "";
}

async function notionFetch(token, endpoint, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${body?.message || body?.code || response.statusText}`);
  }
  return body;
}

function richText(content) {
  return { rich_text: [{ text: { content: String(content || "") } }] };
}

function title(content) {
  return { title: [{ text: { content: String(content || "") } }] };
}

async function existingForDate(token, date) {
  const body = await notionFetch(token, `/databases/${gymDatabaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "Fecha entrenamiento", date: { equals: date } },
      page_size: 100,
    }),
  });
  return (body.results || []).map((page) => {
    const prop = page.properties?.Ejercicio?.title || [];
    return {
      id: page.id,
      title: prop.map((item) => item.plain_text || "").join("").trim().toLowerCase(),
      url: page.url,
    };
  });
}

async function createGymRecord(token, date, item) {
  return notionFetch(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: gymDatabaseId },
      properties: {
        Ejercicio: title(item.exercise),
        "Fecha entrenamiento": { date: { start: date } },
        Series: richText(item.series),
        Repeticiones: richText(item.reps),
        Peso: richText(item.weight),
        Observaciones: richText(item.notes),
      },
    }),
  });
}

const args = parseArgs(process.argv);
if (!args.date || !sessions[args.date]) {
  console.error(`Uso: node agent_tools/repair_coach_gym_session.mjs --date 2026-05-17 [--apply]`);
  process.exit(2);
}

const token = loadEnvToken();
if (!token) {
  console.error("Falta NOTION_API_KEY en secrets/runtime/personal.env.");
  process.exit(1);
}

const existing = await existingForDate(token, args.date);
const existingTitles = new Set(existing.map((item) => item.title));
const planned = sessions[args.date].filter((item) => !existingTitles.has(item.exercise.toLowerCase()));

if (!args.apply) {
  console.log(JSON.stringify({ date: args.date, existing: existing.length, plannedCreates: planned }, null, 2));
  process.exit(0);
}

const created = [];
for (const item of planned) {
  const page = await createGymRecord(token, args.date, item);
  created.push({ exercise: item.exercise, id: page.id, url: page.url });
}

console.log(JSON.stringify({ ok: true, date: args.date, created, skippedExisting: existing.length }, null, 2));

