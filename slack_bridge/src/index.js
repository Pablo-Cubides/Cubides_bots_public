import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { App } from "@slack/bolt";
import { appendConversation, formatRecentConversation, saveLastSlackRoute } from "../../agent_tools/slack_memory.mjs";
import { notionMapPromptBlock } from "../../agent_tools/notion_map.mjs";
import { formatTranscriptsForPrompt, transcribeSlackAudioFiles } from "../../agent_tools/voice_gateway.mjs";
import { collectSlackImages, formatImagesForPrompt } from "../../agent_tools/vision_gateway.mjs";
import { finalizeLedgerIfNeeded, ledgerPromptBlock, updateLedgerFromSlack } from "../../agent_tools/active_task_ledger.mjs";
import { socioGeminiDockerArgs } from "../../agent_tools/socio_runtime.mjs";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const runtimeDir = path.join(repoRoot, ".tmp");
const pidFile = path.join(runtimeDir, "slack-bridge.pid");
const deepResearchDir = path.join(runtimeDir, "deep-research");
const deepResearchJobsDir = path.join(deepResearchDir, "jobs");
const deepResearchStateDir = path.join(deepResearchDir, "state");

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(deepResearchJobsDir, { recursive: true });
fs.mkdirSync(deepResearchStateDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid), "utf8");

function cleanupPid() {
  try {
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) {
      fs.rmSync(pidFile, { force: true });
    }
  } catch {
    // Best effort cleanup only.
  }
}

process.on("exit", cleanupPid);
process.on("SIGINT", () => {
  cleanupPid();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupPid();
  process.exit(0);
});

const agents = [
  {
    id: "colega",
    name: "Colega",
    envFile: "colega.env",
    inboxPath: path.join(repoRoot, "academic_agent", "profile", "inbox", "slack.md"),
    responder: "openclaw",
  },
  {
    id: "coach",
    name: "Coach",
    envFile: "personal.env",
    inboxPath: path.join(repoRoot, "personal_agent", "inbox", "slack.md"),
    responder: "claude",
  },
  {
    id: "socio",
    name: "Socio",
    envFile: "business.env",
    inboxPath: path.join(repoRoot, "business_agent", "data", "tasks", "task_plan.md"),
    taskPrefix: "[SLACK]",
    responder: "gemini",
  },
];

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

const rootEnv = parseEnvFile(path.join(repoRoot, ".env"));

function configValue(name, fallback = "") {
  if (name === "COLEGA_NATIVE_AUDIO_BRIDGE" && rootEnv[name]) return rootEnv[name];
  return process.env[name] || rootEnv[name] || fallback;
}

function cleanMessage(text = "") {
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

// --- Secret scrubber ---------------------------------------------------------
// Carga valores sensibles de los runtime env de los 3 agentes y los redacta de
// CUALQUIER respuesta antes de mandarla a Slack. Esto evita que un agente con
// modo autonomo (yolo / bypassPermissions) filtre credenciales en respuestas
// de error o en explicaciones. Las claves protegidas se identifican por sufijo:
// PASSWORD, TOKEN, KEY, SECRET, OAUTH.
const SECRET_KEY_RE = /(PASSWORD|TOKEN|KEY|SECRET|OAUTH|APP_PASSWORD)$/i;

function loadAllSecrets() {
  const values = new Set();
  const runtimeFiles = ["colega.env", "personal.env", "business.env"];
  for (const f of runtimeFiles) {
    const env = parseEnvFile(path.join(repoRoot, "secrets", "runtime", f));
    for (const [k, v] of Object.entries(env)) {
      if (!v || v.length < 6) continue; // ignora valores triviales
      if (SECRET_KEY_RE.test(k)) values.add(v);
    }
  }
  return Array.from(values).sort((a, b) => b.length - a.length); // mas largos primero
}

const SECRET_VALUES = loadAllSecrets();
console.log(`[scrubber] ${SECRET_VALUES.length} secretos cargados para redaccion en respuestas Slack.`);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactSecrets(text) {
  if (!text || SECRET_VALUES.length === 0) return text;
  let out = String(text);
  for (const value of SECRET_VALUES) {
    if (out.includes(value)) {
      out = out.split(value).join("[REDACTED]");
    }
  }
  // Patron generico: passwords gmail-style "xxxx xxxx xxxx xxxx" (16 chars con
  // espacios cada 4) — captura variantes que el agente reformatee.
  out = out.replace(/\b[a-z]{4}[ -][a-z]{4}[ -][a-z]{4}[ -][a-z]{4}\b/gi, "[REDACTED-AUTH-PATTERN]");
  return out;
}

function appendInbox(agent, event, text) {
  fs.mkdirSync(path.dirname(agent.inboxPath), { recursive: true });
  const stamp = new Date().toISOString();
  const source = `slack:${event.channel || "unknown"}:${event.user || "unknown"}`;

  if (agent.id === "socio") {
    fs.appendFileSync(agent.inboxPath, `\n- [ ] ${agent.taskPrefix} ${text} (${source}, ${stamp})\n`, "utf8");
    return;
  }

  fs.appendFileSync(agent.inboxPath, `\n## ${stamp}\n\n- Source: ${source}\n- Text: ${text}\n`, "utf8");
}

function appendSlackMemory(agent, event, text, role, extra = {}) {
  appendConversation(agent.id, {
    direction: role === "assistant" ? "out" : "in",
    role,
    agentName: agent.name,
    text,
    channel: event.channel || "",
    user: event.user || "",
    thread_ts: event.thread_ts || event.ts || "",
    slack_ts: event.ts || "",
    model: extra.model || "",
    routine: extra.routine || "",
  });
}

function currentBogotaTime() {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

function safeSessionId(agent, event) {
  const raw = `slack-${agent.id}-${event.channel || "channel"}-${event.user || "user"}`;
  return raw.replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 120);
}

function safeSessionSuffix(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_.:-]/g, "-")
    .slice(0, 80);
}

const COLEGA_DEEP_MODEL_LABEL = "deep / gpt-5.3-codex";
const DEEP_RESEARCH_TRIGGERS = [
  /\banaliza(?:r)?\s+a\s+fondo\b/i,
  /\binvestiga(?:r)?\s+profundamente\b/i,
  /\binvestigaci[oó]n\s+profunda\b/i,
  /\bdeep\s+research\b/i,
  /\bmake\s+(?:a\s+)?deep\s+research\b/i,
  /\bresearch\s+(?:deeply|in\s+depth)\b/i,
  /\bmodo\s+profundo\b/i,
  /\bdeep\s+mode\b/i,
  /\busa\s+(?:el\s+)?modo\s+deep\b/i,
  /\busa\s+(?:el\s+)?modelo\s+(?:avanzado|profundo|deep)\b/i,
  /\brevisi[oó]n\s+(?:completa|profunda|exhaustiva|bibliogr[aá]fica)\b/i,
  /\bestado\s+del\s+arte\b/i,
  /\bbenchmark\s+(?:profundo|completo|de mercado)\b/i,
  /\b(?:paper|art[ií]culo|congreso|convocatoria|revista\s+indexada|proyecto\s+de\s+investigaci[oó]n)\b/i,
  /\bresearch\s+skill\b/i,
  /\bdo\s+(?:a\s+)?research\b/i,
  /\bresearch\s+about\b/i,
  /\bopportunit(?:y|ies)\b.*\b(?:market|freelance|business)\b/i,
  /\b(?:mercado|oportunidades|competencia)\b.*\b(?:reporte|documento|drive|pdf|doc|investiga|research)\b/i,
  /\b(?:doc|documento|pdf|drive|slides|presentaci[oó]n)\b.*\b(?:research|investigaci[oó]n|analisis|an[aá]lisis)\b/i,
];

function resolveColegaMode(text) {
  const message = String(text || "");
  const deep = DEEP_RESEARCH_TRIGGERS.some((pattern) => pattern.test(message));
  if (!deep) {
    return {
      id: "normal",
      label: "normal",
      sessionSuffix: "",
      announce: false,
    };
  }

  return {
    id: "deep",
    label: COLEGA_DEEP_MODEL_LABEL,
    sessionSuffix: "deep",
    announce: true,
  };
}

function sessionIdForAgent(agent, event, mode = null) {
  const base = safeSessionId(agent, event);
  if (!mode?.sessionSuffix) return base;
  const thread = safeSessionSuffix(event.thread_ts || event.ts || "thread");
  return `${base}-${mode.sessionSuffix}-${thread}`.slice(0, 120);
}

function isDeepResearchRequest(text) {
  const message = String(text || "");
  if (DEEP_RESEARCH_TRIGGERS.some((pattern) => pattern.test(message))) return true;
  const hasResearchIntent = /\b(research|investiga|investigaci[oó]n|analiza|an[aá]lisis|mercado|benchmark|oportunidades|competencia)\b/i.test(message);
  const hasArtifactIntent = /\b(doc|documento|pdf|drive|slides|presentaci[oó]n|reporte|informe|email|correo)\b/i.test(message);
  const hasDepthIntent = /\b(a fondo|profundo|profundamente|completo|larga|large|exhaustivo|tradicional|market|freelance)\b/i.test(message);
  return hasResearchIntent && (hasArtifactIntent || hasDepthIntent || message.length > 220);
}

function resolveSocioModel(text) {
  const message = String(text || "");
  if (isDeepResearchRequest(message)) return "gemini-2.5-pro";
  if (/^\s*(ok|si|sí|no|gracias|thanks|listo|good night|buenas noches|hola|hello)[\s.!?]*$/i.test(message)) {
    return "gemini-2.5-flash-lite";
  }
  return "gemini-2.5-flash";
}

function wantsSlides(text) {
  return /\b(slides|presentaci[oó]n|diapositivas|pitch|deck|clase|exponer|visual)\b/i.test(String(text || ""));
}

function inferDeepResearchCategory(agentId, text) {
  const value = String(text || "").toLowerCase();
  if (agentId === "colega") {
    if (/clase|presentaci[oó]n|docencia|estudiante/.test(value)) return "Docencia";
    if (/congreso|convocatoria|beca|proyecto/.test(value)) return "Congresos_Convocatorias";
    if (/paper|art[ií]culo|bibliograf|revista/.test(value)) return "Papers_Bibliografia";
    if (/marca|reputaci[oó]n|referente|debate/.test(value)) return "Marca_Academica";
    return "Investigacion";
  }
  if (agentId === "coach") {
    if (/salud|sue[nñ]o|gimnasio|pasos|comida|h[aá]bito/.test(value)) return "Salud";
    if (/relaci[oó]n|pareja|cita|person|long-term relationship/.test(value)) return "Relaciones";
    if (/freelance|trabajo|ingreso|cliente/.test(value)) return "Freelance_Tecnico";
    if (/stack|agente|repo|automatizaci[oó]n|docker|slack/.test(value)) return "Stack_Agentes";
    return "Habitos";
  }
  if (/project-alpha/.test(value)) return "Project_Alpha";
  if (/Project Beta/.test(value)) return "Project Beta";
  if (/Project Gamma|agua|ambiental/.test(value)) return "Project_Gamma";
  if (/seo|marketing|redes|contenido/.test(value)) return "Marketing_SEO";
  return "Mercado_Competencia";
}

function deepResearchTitle(agent, text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,:;¿?¡!()_-]/gu, "")
    .trim();
  const short = clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  return `[${agent.name}] ${short || "Investigacion profunda"}`;
}

function extractEmailRequest(text) {
  const value = String(text || "");
  const slackMail = value.match(/<mailto:([^|>]+)(?:\|[^>]+)?>/i);
  if (slackMail?.[1]) return slackMail[1].trim();
  const plainMail = value.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return plainMail?.[0]?.trim() || null;
}

function vercelObserverPromptBlock() {
  try {
    const result = spawnSync(process.execPath, [path.join(repoRoot, "agent_tools", "vercel_observer.mjs"), "--action", "verify"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 25000,
      windowsHide: true,
    });
    const stdout = String(result.stdout || "").trim();
    const stderr = String(result.stderr || "").trim();
    if (result.status === 0 && stdout) {
      return [
        "Estado Vercel verificado antes de responder:",
        "VERCEL_OBSERVER_OK=true",
        stdout.slice(0, 1400),
        "Interpretacion obligatoria: observer mode es suficiente para revisar proyectos, dominios, deployments y errores. No pidas VERCEL_TOKEN si este bloque existe.",
      ].join("\n");
    }
    return [
      "Estado Vercel verificado antes de responder:",
      "VERCEL_OBSERVER_OK=false",
      `Detalle: ${(stderr || stdout || "sin salida").slice(0, 700)}`,
      "Si falla esta verificacion, informa el fallo concreto sin asumir que el token no existe.",
    ].join("\n");
  } catch (error) {
    return `Estado Vercel verificado antes de responder: VERCEL_OBSERVER_OK=unknown (${String(error).slice(0, 500)})`;
  }
}

async function ensureDeepResearchRunner() {
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(repoRoot, "scripts", "start-deep-research-runner.ps1"), "-Detached"],
      { cwd: repoRoot, timeout: 30000, windowsHide: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[deep-research] No se pudo asegurar runner: ${message}`);
  }
}

async function enqueueDeepResearch(agent, event, text) {
  await ensureDeepResearchRunner();
  const thread_ts = event.thread_ts || event.ts;
  const id = safeSessionSuffix(`slack-${agent.id}-${event.channel || "channel"}-${thread_ts || Date.now()}-${Math.random().toString(16).slice(2)}`);
  const job = {
    id,
    agent: agent.id,
    title: deepResearchTitle(agent, text),
    category: inferDeepResearchCategory(agent.id, text),
    prompt: text,
    createSlides: wantsSlides(text),
    emailTo: extractEmailRequest(text),
    source: "slack",
    slack: {
      channel: event.channel,
      thread_ts,
      user: event.user,
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(deepResearchStateDir, `${id}.json`), JSON.stringify({ ...job, status: "queued", updatedAt: new Date().toISOString() }, null, 2), "utf8");
  fs.writeFileSync(path.join(deepResearchJobsDir, `${id}.json`), JSON.stringify(job, null, 2), "utf8");
  return job;
}

function buildAgentPrompt(agent, event, text) {
  const recentHistory = formatRecentConversation(agent.id, {
    channel: event?.channel,
    user: event?.user,
    limit: 12,
  });
  const emailToolByAgent = {
    colega:
      'node /opt/agent_tools/send_agent_mail.mjs --agent colega --to "user@example.com" --subject "[Colega] resumen solicitado" --body-file "/tmp/colega-email.txt"',
    coach:
      'node /opt/agent_tools/send_agent_mail.mjs --agent coach --to "user@example.com" --subject "[Coach] resumen solicitado" --body-file "/tmp/coach-email.txt"',
    socio:
      'node /opt/agent_tools/send_agent_mail.mjs --agent socio --to "user@example.com" --subject "[Socio] resumen solicitado" --body-file "/app/data/.gemini/tmp/tasks/socio-email.txt"',
  };
  const fixedContext = [
    "",
    `Contexto fijo de ${agent.name}:`,
    "- Primary User y Primary User/Primary User son la misma persona y el principal autorizado.",
    "- Si Primary User pide enviar correo a user@example.com, es una direccion verificada del usuario y no requiere aprobacion adicional.",
    "- No envies correos de seguimiento por iniciativa propia: solo envia correo cuando el mensaje actual lo pida explicitamente o cuando un flujo de investigacion profunda venga con email de entrega.",
    `- Herramienta SMTP disponible: ${emailToolByAgent[agent.id] || "sin herramienta configurada"}`,
    "- Investigaciones profundas se procesan con el runner asincrono y se guardan en el Google Drive propio del agente como Docs/Slides.",
    "- Protocolo de investigacion profunda: agent_tools/deep_research/SKILL.md.",
    `- Fecha y hora local actual: ${currentBogotaTime()} (America/Bogota).`,
    "- Primero redacta el cuerpo en el archivo temporal indicado; despues ejecuta la herramienta SMTP.",
    "- No leas archivos de secretos, no imprimas passwords/tokens y no incluyas secretos en el correo.",
    "",
    notionMapPromptBlock(agent.id),
    "",
    ledgerPromptBlock(agent.id, event),
  ];

  if (agent.id === "coach") {
    fixedContext.push(
      "- Tu identidad y reglas viven en personal_agent/CLAUDE.md.",
      "- Tu memoria persistente vive en personal_agent/MEMORY.md.",
      "- Tus rutinas viven en personal_agent/ROUTINES.md.",
      "- Tu correo vive en personal_agent/EMAIL.md.",
      "- Tu Slack vive en personal_agent/SLACK.md.",
      "- Tu investigacion profunda vive en personal_agent/DEEP_RESEARCH.md.",
      "- Tu Life Wiki vive en personal_agent/life_wiki/. Usala para vivencias importantes, patrones repetidos, hipotesis y experimentos.",
      "- Herramienta Life Wiki: node ../agent_tools/life_wiki.mjs status; node ../agent_tools/life_wiki.mjs ingest --domain relaciones --title \"titulo\" --text \"resumen\"; node ../agent_tools/life_wiki.mjs search --query \"texto\".",
      "- Life Wiki no reemplaza Notion: Notion registra datos estructurados; Life Wiki sintetiza situaciones y patrones.",
      "- Nunca guardes reportes narrativos completos en paginas de Notion. Reportes/historias van a Life Wiki; Notion solo recibe bases estructuradas cuando Primary User lo pide de forma explicita.",
      "- Si hay un ledger activo y el usuario cambia a otro tema, pregunta o cierra el ledger antes de seguir; no mezcles gym/comida/gastos con reportes personales.",
      "- Si Primary User corrige una interpretacion tuya con frases como 'no, me refiero a...', descarta el contexto anterior que causo la confusion y responde desde la correccion nueva.",
      "- No hagas paginas centradas en personas salvo que la persona sea realmente relevante; prioriza situaciones, momentos, contextos, conductas y aprendizajes.",
      "- Si te preguntan si tienes identidad/rutinas/memoria, responde que si existen y cita esos archivos, sin inventar datos personales no documentados.",
    );
  }
  if (agent.id === "socio") {
    fixedContext.push(
      "- URLs actuales de proyectos en Vercel: Project Alpha=https://project-alpha.example.com/; Project Beta=https://Project Beta-mu.vercel.app/; Project Gamma=https://project-gamma.example.com/.",
      "- No trates project-alpha.example.com como prioridad activa ni URL oficial mientras Primary User no reactive ese dominio. Si pregunta por URLs actuales, responde con las URLs de Vercel anteriores.",
      "- Vercel observer mode esta activo. Sirve para observar proyectos, dominios, deployments, eventos y errores sin modificar nada. No lo interpretes como falta de permisos.",
      "- Vercel observer/read-only es el estado correcto ahora, no una limitacion. Si necesitas logs de runtime que esta herramienta no exponga, dilo como alcance pendiente especifico; no pidas otro token por defecto.",
      "- Usa: node /opt/agent_tools/vercel_observer.mjs --action verify; node /opt/agent_tools/vercel_observer.mjs --action list-projects; node /opt/agent_tools/vercel_observer.mjs --action list-deployments --project project-alpha --limit 5; node /opt/agent_tools/vercel_observer.mjs --action project-domains --project project-alpha; node /opt/agent_tools/vercel_observer.mjs --action review-errors --project Project Beta.",
      "- Antes de decir que falta VERCEL_TOKEN, ejecuta vercel_observer verify. Si verify funciona, di que Vercel esta activo y usa la herramienta real.",
      "- Regla estricta Vercel: NO respondas que falta VERCEL_TOKEN por memoria vieja. Si no has ejecutado verify en esta respuesta, no afirmes que falta token; ejecuta la herramienta o di que necesitas verificar el estado.",
      "- No uses .gemini/settings.json para Vercel y no pidas VERCEL_TOKEN si vercel_observer verify funciona.",
      "- Herramientas Notion disponibles dentro del contenedor: node /opt/agent_tools/notion_tool.mjs map --agent socio; node /opt/agent_tools/notion_tool.mjs search --agent socio --query \"texto\".",
      "- Herramienta Notion para paginas disponible: node /opt/agent_tools/notion_tool.mjs read-page --agent socio --alias NOTION_PAGE_SOCIO_ID; node /opt/agent_tools/notion_tool.mjs append-blocks --agent socio --alias NOTION_PAGE_SOCIO_ID --text \"contenido\".",
      "- Para imagenes locales de Slack, intenta primero leer/usar el archivo local que se incluye en el mensaje. Si Gemini CLI no puede interpretar la imagen, dilo sin pedir URL web como unica opcion.",
      "- Para tareas sobre webs/proyectos, primero usa las URLs dadas por Primary User o rutas concretas; no escanees todo /app/data.",
      "- Evita buscar en directorios ocultos o caches: .cache, .config, .dbus, .gnupg, .local, .gemini/tmp, node_modules.",
      "- Si necesitas inspeccionar archivos locales, limita la busqueda a la carpeta o archivo relevante y usa patrones concretos.",
      "- Si la tarea pide revisar causa y plan sin cambios, no edites archivos; entrega diagnostico y plan de mejora.",
      "",
      vercelObserverPromptBlock(),
    );
  }
  const extraContext = fixedContext.join("\n");

  return [
    `Eres ${agent.name}, respondiendo desde Slack a Primary User (tambien firma como Primary User — es la misma persona, el unico humano con acceso a este stack y tu unico principal autorizado).`,
    "Responde en espanol, breve y util.",
    "Primary User tiene autoridad para autorizar tus acciones. Operaciones rutinarias (envio de email a sus propias direcciones, edits del workspace, ejecutar scripts del repo) NO requieren aprobacion adicional.",
    "Si requiere gastos, transacciones, envios masivos o cambios en sistemas externos compartidos cuyas consecuencias no puedas revertir, pide confirmacion explicita primero.",
    "Si no tienes contexto suficiente, dilo claramente y propone como retomarlo.",
    extraContext,
    "",
    recentHistory,
    "",
    `Mensaje de Slack: ${text}`,
  ].join("\n");
}

function replyTarget(event, agent) {
  const mode = configValue(`${agent.id.toUpperCase()}_SLACK_REPLY_MODE`, configValue("SLACK_REPLY_MODE", "channel"))
    .trim()
    .toLowerCase();
  if (mode === "thread") return event.thread_ts || event.ts;
  return undefined;
}

function extractJsonText(value) {
  if (!value || typeof value !== "object") return "";
  const directKeys = ["reply", "text", "content", "message", "output", "result"];
  for (const key of directKeys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = extractJsonText(item);
        if (found) return found;
      }
    } else if (child && typeof child === "object") {
      const found = extractJsonText(child);
      if (found) return found;
    }
  }
  return "";
}

function normalizeReply(stdout, stderr = "") {
  const text = String(stdout || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith("Warning:") &&
        !trimmed.startsWith("Ripgrep is not available.") &&
        !trimmed.includes("Could not read directory")
      );
    })
    .join("\n")
    .trim();
  if (!text) {
    const errorText = String(stderr || "").trim();
    return errorText ? `No pude generar respuesta completa. Detalle: ${errorText.slice(0, 600)}` : "No pude generar respuesta.";
  }

  try {
    const parsed = JSON.parse(text);
    const extracted = extractJsonText(parsed);
    if (extracted) return extracted;
  } catch {
    // Plain text is fine.
  }

  return text;
}

function trimForSlack(text) {
  const clean = String(text || "").trim();
  if (clean.length <= 3500) return clean;
  return `${clean.slice(0, 3400)}\n\n[Respuesta recortada por longitud. El detalle queda en la memoria/bandeja del agente.]`;
}

function friendlyAgentError(agent, rawError) {
  const message = String(rawError || "");
  if (/429|Too Many Requests|quota|rate.?limit|resource exhausted/i.test(message)) {
    return `${agent.name} recibio tu mensaje, pero el modelo esta limitado temporalmente por cuota o rate limit. Lo dejo en bandeja local para procesarlo cuando haya disponibilidad.`;
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return `${agent.name} recibio tu mensaje, pero la respuesta en vivo tardo demasiado. Lo dejo en bandeja local para reintento o revision posterior.`;
  }
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(message)) {
    return `${agent.name} recibio tu mensaje, pero hay un problema temporal de red o conexion con el modelo. Lo dejo en bandeja local.`;
  }
  return `${agent.name} recibio tu mensaje, pero no pudo responder en vivo. Lo dejo en bandeja local sin exponer detalles tecnicos.`;
}

async function runCommand(file, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd: repoRoot,
      timeout: options.timeoutMs || 180000,
      maxBuffer: 1024 * 1024 * 2,
      windowsHide: true,
      input: options.input,
    });
    return normalizeReply(stdout, stderr);
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? error.stdout : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? error.stderr : "";
    const code = typeof error === "object" && error && "code" in error ? error.code : "";
    if (stderr) console.log(`[runCommand] stderr (exit=${code}): ${String(stderr).slice(0, 1500)}`);
    const reply = normalizeReply(stdout, stderr);
    if (reply && !reply.startsWith("No pude generar")) return reply;
    if (stderr) {
      const trimmed = String(stderr).trim().slice(-600);
      const enriched = new Error(`exit=${code} | stderr: ${trimmed}`);
      throw enriched;
    }
    throw error;
  }
}

async function runOpenClaw(sessionId, message, timeoutMs = 240000) {
  return runCommand(
    "docker",
    [
      "exec",
      "colega",
      "openclaw",
      "agent",
      "--session-id",
      sessionId,
      "--message",
      message,
      "--thinking",
      "low",
      "--json",
    ],
    { timeoutMs },
  );
}

async function askAgent(agent, event, text) {
  const prompt = buildAgentPrompt(agent, event, text);
  if (agent.responder === "openclaw") {
    const mode = resolveColegaMode(text);
    const sessionId = sessionIdForAgent(agent, event, mode);

    if (mode.id === "deep") {
      console.log(`[${agent.name}] Activando modo profundo para sesion ${sessionId}`);
      await runOpenClaw(sessionId, "/model deep", 120000);
    }

    const reply = await runOpenClaw(sessionId, prompt, 240000);
    if (mode.announce) {
      return `Modo Colega: profundo (${mode.label}).\n\n${reply}`;
    }
    return reply;
  }

  if (agent.responder === "claude") {
    // Coach usa CLAUDE_CODE_OAUTH_TOKEN (plan Pro/Max). Con OAuth el uso sale del
    // cupo del plan (ventana rodante 5h + cap semanal), NO del costo por token.
    // `--max-budget-usd` solo cappea el costo estimado localmente y aborta antes
    // de responder cuando lo cruza, aunque no haya cobro real. Por eso no se usa
    // aqui: el cap real lo gobierna el plan Pro/Max.
    //
    // permission-mode = bypassPermissions: el unico humano con acceso es Primary User
    // (decision explicita). Las salvaguardas siguen activas: deny-list en
    // .claude/settings.json (lectura/escritura de secrets/.env/.age) y hook
    // PreToolUse en Bash que bloquea comandos tocando esos paths. Claude Code
    // aplica deny-list y hooks ANTES de cualquier mode, asi que bypassPermissions
    // solo elimina los prompts interactivos que no funcionan en -p mode.
    return runCommand(
      "docker",
      [
        "exec",
        "-w",
        "/home/claude/workspace/personal_agent",
        "personal",
        "claude",
        "-p",
        prompt,
        "--model",
        "sonnet",
        "--permission-mode",
        "bypassPermissions",
      ],
      { timeoutMs: 240000 },
    );
  }

  if (agent.responder === "gemini") {
    // approval-mode = yolo: el unico operador es Primary User, Slack es canal principal,
    // se buscan acciones reales (envio email, etc.). Salvaguardas: secrets SOPS+AGE,
    // deny-list, hooks, escape de input. Si quieres revertir a planificar sin actuar
    // cambia "yolo" por "plan".
    const model = resolveSocioModel(text);
    return runCommand(
      "docker",
      socioGeminiDockerArgs({ model, prompt, approvalMode: "yolo", outputFormat: "text" }),
      { timeoutMs: 180000 },
    );
  }

  return `${agent.name} recibio el mensaje, pero aun no tiene responder en vivo configurado.`;
}

async function startAgentBridge(agent) {
  const colegaSlackMode = configValue("COLEGA_SLACK_MODE", "bridge").trim().toLowerCase();
  const audioOnly = agent.id === "colega" && colegaSlackMode === "native";
  const colegaNativeAudioBridge = configValue("COLEGA_NATIVE_AUDIO_BRIDGE", "false").trim().toLowerCase();
  if (audioOnly && !/^(1|true|yes|on)$/.test(colegaNativeAudioBridge)) {
    console.log(
      "[Colega] Slack Bridge omitido porque COLEGA_SLACK_MODE=native. Audio de Colega queda en OpenClaw nativo; el puente local solo se activa con COLEGA_NATIVE_AUDIO_BRIDGE=true o COLEGA_SLACK_MODE=bridge.",
    );
    return null;
  }

  const envPath = path.join(repoRoot, "secrets", "runtime", agent.envFile);
  const env = parseEnvFile(envPath);
  const token = env.SLACK_BOT_TOKEN;
  const appToken = env.SLACK_APP_TOKEN;

  if (!token || !appToken) {
    console.log(`[${agent.name}] Slack no configurado en ${envPath}`);
    return null;
  }

  const app = new App({
    token,
    appToken,
    socketMode: true,
  });

  const receive = async ({ event, say }) => {
    if (event.bot_id || (event.subtype && event.subtype !== "file_share")) return;
    const hasAudio = Array.isArray(event.files) && event.files.length > 0;
    if (audioOnly && !hasAudio) return;

    const originalText = cleanMessage(event.text || "");
    let text = originalText;
    const thread_ts = event.thread_ts || event.ts;
    const responseThread = replyTarget(event, agent);

    try {
      const audioResult = await transcribeSlackAudioFiles({
        agent,
        event,
        token,
        repoRoot,
        env: { ...process.env, ...env, ...rootEnv },
      });
      if (audioResult.transcripts.length > 0) {
        const transcriptText = formatTranscriptsForPrompt(audioResult.transcripts);
        text = [originalText, transcriptText].filter(Boolean).join("\n\n");
        const summary = audioResult.transcripts
          .map((item) => `Audio transcrito (${item.engine}): ${item.name}`)
          .join("\n");
        await say({ text: summary, thread_ts: responseThread });
      }
      for (const notice of audioResult.notices) {
        await say({ text: notice, thread_ts: responseThread });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await say({
        text: `${agent.name} recibio un audio, pero no pude transcribirlo localmente: ${redactSecrets(message).slice(0, 900)}`,
        thread_ts: responseThread,
      });
    }

    try {
      const imageResult = await collectSlackImages({
        agent,
        event,
        token,
        env: { ...process.env, ...env, ...rootEnv },
      });
      if (imageResult.images.length > 0) {
        const imageText = formatImagesForPrompt(imageResult.images, agent.id);
        text = [text, imageText].filter(Boolean).join("\n\n");
        await say({
          text: `Imagen recibida y guardada para analisis (${imageResult.images.length}).`,
          thread_ts: responseThread,
        });
      }
      for (const notice of imageResult.notices) {
        await say({ text: notice, thread_ts: responseThread });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await say({
        text: `${agent.name} recibio imagen(es), pero no pude prepararlas: ${redactSecrets(message).slice(0, 900)}`,
        thread_ts: responseThread,
      });
    }

    if (!text) return;
    console.log(`[${agent.name}] Mensaje recibido desde Slack: ${text.slice(0, 120)}`);
    if (agent.id !== "socio") appendInbox(agent, event, text);
    saveLastSlackRoute(agent.id, {
      channel: event.channel,
      user: event.user,
      thread_ts: event.thread_ts || event.ts,
    });
    const ledger = updateLedgerFromSlack(agent.id, event, text);
    appendSlackMemory(agent, event, text, "user");

    if (isDeepResearchRequest(text)) {
      try {
        const job = await enqueueDeepResearch(agent, event, text);
        await say({
          text: `${agent.name} inicio una investigacion profunda asincrona.\nJob: ${job.id}\nCategoria: ${job.category}\nTe aviso en este hilo cuando deje el Doc${job.createSlides ? " y Slides" : ""} en Drive.`,
          thread_ts: responseThread,
        });
        appendSlackMemory(agent, event, `Investigacion profunda encolada. Job: ${job.id}. Categoria: ${job.category}.`, "assistant", {
          model: "deep-research-runner",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const reply = redactSecrets(`${agent.name} no pudo encolar la investigacion profunda: ${message.slice(0, 700)}`);
        await say({ text: reply, thread_ts: responseThread });
        appendSlackMemory(agent, event, reply, "assistant", { model: "deep-research-runner" });
      }
      return;
    }

    await say({ text: `${agent.name} esta revisando tu mensaje...`, thread_ts: responseThread });
    try {
      const reply = await askAgent(agent, event, text);
      console.log(`[${agent.name}] Respuesta generada (${reply.length} chars)`);
      let cleanReply = trimForSlack(redactSecrets(reply));
      const finalized = finalizeLedgerIfNeeded(agent.id, event, text);
      if (finalized) {
        cleanReply = `${cleanReply}\n\n[Ledger cerrado: ${finalized.ledger.entries.length} entradas archivadas para estadísticas futuras.]`;
      } else if (ledger?.entries?.length) {
        cleanReply = `${cleanReply}\n\n[Ledger activo: ${ledger.entries.length} entradas registradas en esta tarea.]`;
      }
      await say({ text: cleanReply, thread_ts: responseThread });
      appendSlackMemory(agent, event, cleanReply, "assistant");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${agent.name}] Error respondiendo: ${message}`);
      if (agent.id === "socio") appendInbox(agent, event, text);
      const reply = redactSecrets(friendlyAgentError(agent, message));
      await say({ text: reply, thread_ts: responseThread });
      appendSlackMemory(agent, event, reply, "assistant");
    }
  };

  app.event("app_mention", receive);
  app.message(async ({ message, say }) => {
    if (message.subtype && message.subtype !== "file_share") return;
    await receive({ event: message, say });
  });

  await app.start();
  console.log(`[${agent.name}] Slack Socket Mode activo${audioOnly ? " (solo transcripcion de audios; texto normal queda en OpenClaw nativo)" : ""}`);
  return app;
}

const started = [];
for (const agent of agents) {
  const app = await startAgentBridge(agent);
  if (app) started.push(app);
}

if (started.length === 0) {
  console.log("No hay agentes Slack activos. Configura secretos y regenera runtime env.");
}


