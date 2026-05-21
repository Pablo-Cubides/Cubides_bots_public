import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const AGENTS = {
  colega: {
    envFile: "colega.env",
    defaultCalendar: "Colega - Agenda",
    defaultRoot: "Agents Hub",
  },
  coach: {
    envFile: "personal.env",
    defaultCalendar: "Coach - Agenda",
    defaultRoot: "Agents Hub",
  },
  socio: {
    envFile: "business.env",
    defaultCalendar: "Socio - Agenda",
    defaultRoot: "Agents Hub",
  },
};

const ROOT_FOLDERS = ["00_Inbox", "01_Deep_Research", "02_Rutinas", "03_Reunion_Dominical", "04_Memoria", "05_Slides"];

const CATEGORY_BY_AGENT = {
  colega: ["Docencia", "Investigacion", "Congresos_Convocatorias", "Papers_Bibliografia", "Marca_Academica", "Clases_Presentaciones"],
  coach: ["Salud", "Relaciones", "Freelance_Tecnico", "Habitos", "Stack_Agentes", "Planes_Visuales"],
  socio: ["Project_Alpha", "Project Beta", "Project_Gamma", "Mercado_Competencia", "Marketing_SEO", "Pitch_Decks"],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseEnvFile(filePath) {
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

function loadAgentEnv(agentId) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error(`Agente invalido: ${agentId}`);
  return {
    ...parseEnvFile(path.join(repoRoot, "secrets", "runtime", agent.envFile)),
    ...process.env,
  };
}

function requireConfig(agentId) {
  const env = loadAgentEnv(agentId);
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Faltan secretos Google para ${agentId}: ${missing.join(", ")}`);
  return env;
}

async function googleFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const errorCode = typeof body?.error === "string" ? body.error : "";
    const message = body?.error?.message || body?.error_description || text || response.statusText;
    const detail = errorCode ? `${errorCode}: ${message}` : message;
    throw new Error(`Google API ${response.status}: ${detail}`);
  }
  return body;
}

async function accessToken(config) {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    refresh_token: config.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const token = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  return token.access_token;
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(token, name, parentId = null) {
  const parts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${escapeDriveQuery(name)}'`,
  ];
  if (parentId) parts.push(`'${escapeDriveQuery(parentId)}' in parents`);
  const query = encodeURIComponent(parts.join(" and "));
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&spaces=drive&pageSize=10`;
  const result = await googleFetch(url, { headers: authHeaders(token) });
  return result.files?.[0] || null;
}

async function createFolder(token, name, parentId = null) {
  const metadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentId ? { parents: [parentId] } : {}),
  };
  return googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(metadata),
  });
}

async function ensureFolder(token, name, parentId = null) {
  return (await findFolder(token, name, parentId)) || createFolder(token, name, parentId);
}

async function ensureFolderPath(token, rootId, segments) {
  let parent = rootId;
  let folder = null;
  for (const segment of segments.filter(Boolean)) {
    folder = await ensureFolder(token, segment, parent);
    parent = folder.id;
  }
  return folder || { id: rootId };
}

async function ensureWorkspace(agentId, token, config) {
  const agent = AGENTS[agentId];
  const root = config.GOOGLE_DRIVE_ROOT_FOLDER_ID
    ? { id: config.GOOGLE_DRIVE_ROOT_FOLDER_ID, name: agent.defaultRoot }
    : await ensureFolder(token, agent.defaultRoot);

  for (const folder of ROOT_FOLDERS) {
    await ensureFolder(token, folder, root.id);
  }

  return root;
}

function normalizeCategory(agentId, category = "") {
  const fallback = agentId === "colega" ? "Investigacion" : agentId === "coach" ? "Stack_Agentes" : "Mercado_Competencia";
  const allowed = CATEGORY_BY_AGENT[agentId] || [];
  if (allowed.includes(category)) return category;
  const normalized = allowed.find((item) => item.toLowerCase() === String(category).toLowerCase());
  return normalized || fallback;
}

async function createGoogleDoc({ agentId, token, config, title, category, body }) {
  const root = await ensureWorkspace(agentId, token, config);
  const year = new Date().getFullYear().toString();
  const folder = await ensureFolderPath(token, root.id, ["01_Deep_Research", year, normalizeCategory(agentId, category), "03_Reportes_Finales"]);
  const file = await googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: [folder.id],
    }),
  });
  await googleFetch(`https://docs.googleapis.com/v1/documents/${file.id}:batchUpdate`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: body } }],
    }),
  });
  return file;
}

function slideTextBlocks(body) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "") || "Investigacion profunda";
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line)).slice(0, 12).map((line) => line.replace(/^[-*]\s+/, ""));
  return { title, bullets: bullets.length ? bullets : lines.slice(0, 8) };
}

async function createGoogleSlides({ agentId, token, config, title, category, body }) {
  const root = await ensureWorkspace(agentId, token, config);
  const year = new Date().getFullYear().toString();
  const folder = await ensureFolderPath(token, root.id, ["05_Slides", year, normalizeCategory(agentId, category)]);
  const presentation = await googleFetch("https://slides.googleapis.com/v1/presentations", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title }),
  });

  await googleFetch(`https://www.googleapis.com/drive/v3/files/${presentation.presentationId}?addParents=${encodeURIComponent(folder.id)}&fields=id,name,webViewLink`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ name: title }),
  });

  const blocks = slideTextBlocks(body);
  const bulletText = blocks.bullets.map((item) => `• ${item}`).join("\n");
  await googleFetch(`https://slides.googleapis.com/v1/presentations/${presentation.presentationId}:batchUpdate`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      requests: [
        { createSlide: { objectId: "deep_research_summary", slideLayoutReference: { predefinedLayout: "BLANK" } } },
        {
          createShape: {
            objectId: "deep_title",
            shapeType: "TEXT_BOX",
            elementProperties: { pageObjectId: "deep_research_summary", size: { width: { magnitude: 640, unit: "PT" }, height: { magnitude: 80, unit: "PT" } }, transform: { scaleX: 1, scaleY: 1, translateX: 40, translateY: 40, unit: "PT" } },
          },
        },
        { insertText: { objectId: "deep_title", text: blocks.title } },
        {
          createShape: {
            objectId: "deep_body",
            shapeType: "TEXT_BOX",
            elementProperties: { pageObjectId: "deep_research_summary", size: { width: { magnitude: 640, unit: "PT" }, height: { magnitude: 340, unit: "PT" } }, transform: { scaleX: 1, scaleY: 1, translateX: 40, translateY: 140, unit: "PT" } },
          },
        },
        { insertText: { objectId: "deep_body", text: bulletText || "Ver documento completo para detalles." } },
      ],
    }),
  });

  return {
    id: presentation.presentationId,
    name: title,
    webViewLink: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
  };
}

async function ensureCalendar(agentId, token, config) {
  if (config.GOOGLE_CALENDAR_ID) return { id: config.GOOGLE_CALENDAR_ID, summary: AGENTS[agentId].defaultCalendar };
  const summary = AGENTS[agentId].defaultCalendar;
  const list = await googleFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner", {
    headers: authHeaders(token),
  });
  const existing = list.items?.find((item) => item.summary === summary);
  if (existing) return existing;
  return googleFetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ summary, timeZone: "America/Bogota" }),
  });
}

async function createCalendarEvent({ agentId, token, config, title, description, start, end }) {
  const calendar = await ensureCalendar(agentId, token, config);
  const prefix = agentId === "colega" ? "[Colega]" : agentId === "coach" ? "[Coach]" : "[Socio]";
  const event = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?sendUpdates=none`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      summary: `${prefix} ${title}`,
      description,
      start: { dateTime: start, timeZone: "America/Bogota" },
      end: { dateTime: end, timeZone: "America/Bogota" },
    }),
  });
  return { ...event, calendarId: calendar.id };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agentId = args.agent;
  const action = args.action || "ensure";
  if (!AGENTS[agentId]) throw new Error("Usa --agent colega|coach|socio");
  const config = requireConfig(agentId);
  const token = await accessToken(config);

  if (action === "ensure" || action === "verify") {
    const root = await ensureWorkspace(agentId, token, config);
    const calendar = await ensureCalendar(agentId, token, config);
    console.log(JSON.stringify({ ok: true, rootFolderId: root.id, calendarId: calendar.id, calendarSummary: calendar.summary }, null, 2));
    return;
  }

  const title = args.title || `Investigacion profunda ${new Date().toISOString().slice(0, 10)}`;
  const category = args.category || "";
  const body = args["body-file"] ? fs.readFileSync(args["body-file"], "utf8") : args.body || "";

  if (action === "create-doc") {
    const doc = await createGoogleDoc({ agentId, token, config, title, category, body });
    console.log(JSON.stringify({ ok: true, doc }, null, 2));
    return;
  }

  if (action === "create-slides") {
    const slides = await createGoogleSlides({ agentId, token, config, title, category, body });
    console.log(JSON.stringify({ ok: true, slides }, null, 2));
    return;
  }

  if (action === "create-event") {
    const event = await createCalendarEvent({
      agentId,
      token,
      config,
      title,
      description: body || args.description || "",
      start: args.start,
      end: args.end,
    });
    console.log(JSON.stringify({ ok: true, event }, null, 2));
    return;
  }

  throw new Error(`Accion no soportada: ${action}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


