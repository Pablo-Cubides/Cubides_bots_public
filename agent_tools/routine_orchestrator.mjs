import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  appendConversation,
  formatRecentConversation,
  readEnvFile,
  readLastSlackRoute,
  repoRoot,
  resolveSlackChannel,
} from "./slack_memory.mjs";
import { notionMapPromptBlock } from "./notion_map.mjs";
import { socioGeminiDockerArgs } from "./socio_runtime.mjs";

const execFileAsync = promisify(execFile);

const runtimeDir = path.join(repoRoot, "logs", "runtime", "routines");
const stateDir = path.join(runtimeDir, "state");
const locksDir = path.join(runtimeDir, "locks");
const logDir = path.join(repoRoot, "logs");
const logFile = path.join(logDir, "routine-orchestrator.log");
const pidFile = path.join(runtimeDir, "orchestrator.pid");

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(locksDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

const AGENTS = {
  colega: {
    id: "colega",
    name: "Colega",
    humanName: "Primary User",
    envFile: "colega.env",
    sessionPrefix: "colega",
    defaultModel: "openclaw/gpt-5.4",
  },
  coach: {
    id: "coach",
    name: "Coach",
    humanName: "Primary User",
    envFile: "personal.env",
    defaultModel: "claude/sonnet",
  },
  socio: {
    id: "socio",
    name: "Socio",
    humanName: "Primary User",
    envFile: "business.env",
    defaultModel: "gemini/gemini-2.5-flash",
  },
};

const ROUTINES = {
  daily_improvement_plan: {
    id: "daily_improvement_plan",
    label: "rutina de manana",
    schedule: { hour: 8, minute: 5, days: "daily" },
  },
  nightly_review: {
    id: "nightly_review",
    label: "rutina nocturna",
    schedule: { hour: 21, minute: 30, days: "daily" },
  },
  sunday_roundtable: {
    id: "sunday_roundtable",
    label: "reunion dominical",
    schedule: { hour: 17, minute: 0, days: "sunday" },
  },
};

const ROUTINE_ALIASES = {
  morning: "daily_improvement_plan",
  daily: "daily_improvement_plan",
  night: "nightly_review",
  nightly: "nightly_review",
  sunday: "sunday_roundtable",
};

const nativeRoutineSkipLogged = new Set();

function parseArgs(argv) {
  const args = {
    agent: "all",
    routine: "",
    loop: false,
    once: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--agent") args.agent = argv[++i] || "all";
    else if (item === "--routine") args.routine = ROUTINE_ALIASES[argv[++i]] || argv[i];
    else if (item === "--loop") args.loop = true;
    else if (item === "--once") args.once = true;
    else if (item === "--dry-run") args.dryRun = true;
  }
  return args;
}

function runtimeEnv(agent) {
  return readEnvFile(path.join(repoRoot, "secrets", "runtime", agent.envFile));
}

function rootEnv() {
  return readEnvFile(path.join(repoRoot, ".env"));
}

function configValue(name, fallback = "") {
  const env = rootEnv();
  return process.env[name] || env[name] || fallback;
}

function appendLog(message) {
  const line = `\n- [${new Date().toISOString()}] ${message}`;
  fs.appendFileSync(logFile, line, "utf8");
  console.log(message);
}

function writeState(agentId, routineId, patch) {
  const filePath = path.join(stateDir, `${agentId}-${routineId}.json`);
  let previous = {};
  if (fs.existsSync(filePath)) {
    try {
      previous = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      previous = {};
    }
  }
  const next = { ...previous, agentId, routineId, updatedAt: new Date().toISOString(), ...patch };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
}

function bogotaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function currentBogotaText() {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

function stateLastDate(agentId, routineId) {
  const filePath = path.join(stateDir, `${agentId}-${routineId}.json`);
  if (!fs.existsSync(filePath)) return "";
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return state.lastRunDate || "";
  } catch {
    return "";
  }
}

function routineRunKey(routineId) {
  const parts = bogotaDateParts();
  const routine = ROUTINES[routineId];
  return routine.schedule.days === "sunday" ? `${parts.dateKey}-sunday` : parts.dateKey;
}

function stateCurrentRunDate(agentId, routineId) {
  const filePath = path.join(stateDir, `${agentId}-${routineId}.json`);
  if (!fs.existsSync(filePath)) return "";
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return state.currentRunDate || state.claimedRunDate || "";
  } catch {
    return "";
  }
}

function isRoutineDue(routineId, agentId) {
  const routine = ROUTINES[routineId];
  const parts = bogotaDateParts();
  if (routine.schedule.days === "sunday" && parts.weekday !== "Sun") return false;

  const currentMinutes = parts.hour * 60 + parts.minute;
  const targetMinutes = routine.schedule.hour * 60 + routine.schedule.minute;
  const catchupMinutes = Number(configValue("ROUTINE_CATCHUP_MINUTES", "120"));
  const insideWindow = currentMinutes >= targetMinutes && currentMinutes <= targetMinutes + catchupMinutes;
  if (!insideWindow) return false;

  const key = routineRunKey(routineId);
  return stateLastDate(agentId, routineId) !== key && stateCurrentRunDate(agentId, routineId) !== key;
}

function markRoutineRun(agentId, routineId) {
  writeState(agentId, routineId, { lastRunDate: routineRunKey(routineId), currentRunDate: "" });
}

function routineLockPath(agentId, routineId) {
  return path.join(locksDir, `${agentId}-${routineId}.lock`);
}

function acquireRoutineLock(agentId, routineId) {
  const filePath = routineLockPath(agentId, routineId);
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > 3 * 60 * 60 * 1000) {
        fs.rmSync(filePath, { force: true });
        appendLog(`[${AGENTS[agentId]?.name || agentId}] Lock obsoleto removido para ${routineId}.`);
      }
    }
    const fd = fs.openSync(filePath, "wx");
    fs.writeFileSync(fd, JSON.stringify({
      agentId,
      routineId,
      pid: process.pid,
      runKey: routineRunKey(routineId),
      createdAt: new Date().toISOString(),
    }, null, 2));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

function releaseRoutineLock(agentId, routineId) {
  fs.rmSync(routineLockPath(agentId, routineId), { force: true });
}

function routinePrompt(agent, routineId) {
  const routine = ROUTINES[routineId];
  const recentHistory = formatRecentConversation(agent.id, { limit: 18 });
  const shared = [
    `Fecha y hora local: ${currentBogotaText()} (America/Bogota).`,
    `Esta es la ${routine.label} de ${agent.name}.`,
    `Hablas con ${agent.humanName}. Primary User y Primary User son la misma persona; usa el nombre natural de tu agente.`,
    "La rutina debe sentirse como conversacion por Slack, no como una notificacion seca.",
    "Propón pocas prioridades útiles y conecta cada una con objetivos, pendientes reales y memoria reciente.",
    "No guardes en Drive un plan ligero de 3 tareas. Drive queda para reportes amplios, investigaciones, documentos grandes o presentaciones.",
    "Si mencionas una mejora grande del agente, trátala como propuesta para aprobar durante el día; si ya fue aprobada, reporta avance real.",
    "No imprimas secretos ni claves. Eventos de calendario con invitados externos, dinero o compromisos legales requieren confirmacion.",
    "",
    notionMapPromptBlock(agent.id),
  ];

  const perAgent = {
    colega: [
      "Eres Colega, agente academico. Enfocate en docencia, investigaciones, papers, congresos, convocatorias, marca academica y herramientas para Primary User.",
      "Tu estructura vive en academic_agent/profile/COLEGA_PROFILE.md, ROUTINES.md, SLACK.md, EMAIL.md y DEEP_RESEARCH.md.",
      "Si esta rutina corre por fallback del bridge, conserva memoria local y deja que OpenClaw mantenga la sesion persistente.",
    ],
    coach: [
      "Eres Coach, agente personal y tecnico. Enfocate en salud, habitos, productividad, relaciones, ingresos freelance propios y mejora del stack.",
      "Debes usar CLAUDE.md, MEMORY.md y ROUTINES.md como memoria y reglas. Actualiza MEMORY.md solo con decisiones o datos importantes.",
      "Haz preguntas naturales si necesitas datos del dia, sueño, pasos, comida, gimnasio, animo o bloqueos.",
    ],
    socio: [
      "Eres Socio, agente de negocio. Enfocate en Project Alpha, Project Beta y Project Gamma: comunidad, campañas, legalidad, reputacion, ingresos y metricas.",
      "Usa identity/, memory/, tasks/, logs/ y .agent/skills/ como estructura natural. No llenes task_plan.md salvo que surjan tareas reales.",
      "La conversacion debe abrir espacio para decisiones de negocio, no solo enumerar pendientes.",
    ],
  };

  const routineSpecific = {
    daily_improvement_plan: [
      "Rutina de manana: saluda, pregunta por el contexto del dia y propone un plan breve de prioridades para hoy.",
      "Incluye estado de mejoras aprobadas ayer si hay memoria de eso.",
      "Incluye una propuesta grande de mejora del agente o de su dominio para que el humano pueda aprobarla durante el dia.",
    ],
    nightly_review: [
      "Rutina nocturna: saluda de cierre, pregunta como fue el dia en tu ambito y pide datos concretos para consolidar memoria.",
      "Registra mentalmente avances, bloqueos y acuerdos importantes para que la manana siguiente tenga continuidad.",
      "Si existe una mejora grande aprobada hoy, explica si puedes ejecutarla esta noche o que falta.",
    ],
    sunday_roundtable: [
      "Reunion dominical: prepara insumos amplios para discutir la semana, con oportunidades, riesgos, prioridades y coordinacion con otros agentes.",
      "Puedes proponer mas de tres actividades si hay material suficiente, priorizadas por impacto y esfuerzo.",
      "Si el resultado es amplio o investigativo, sugiere guardarlo en Drive/Docs.",
    ],
  };

  return [
    ...shared,
    "",
    ...(perAgent[agent.id] || []),
    "",
    ...(routineSpecific[routineId] || []),
    "",
    recentHistory,
    "",
    "Entrega ahora el mensaje que debe aparecer en Slack.",
  ].join("\n");
}

async function runCommand(file, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(file, args, {
    cwd: repoRoot,
    timeout: options.timeoutMs || 240000,
    maxBuffer: 1024 * 1024 * 3,
    windowsHide: true,
  });
  const text = [stdout, stderr].filter(Boolean).join("\n").replace(/\u001b\[[0-9;]*m/g, "").trim();
  return text || "Comando completado sin salida.";
}

function extractReply(text) {
  const clean = String(text || "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (typeof parsed === "string") return parsed;
    for (const key of ["reply", "text", "content", "message", "result", "output"]) {
      if (typeof parsed[key] === "string") return parsed[key];
    }
  } catch {
    // Plain text is fine.
  }
  return clean;
}

function cleanAgentOutput(text) {
  return String(text || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith("Warning:") &&
        !trimmed.startsWith("Ripgrep is not available.") &&
        !trimmed.includes("YOLO mode is enabled") &&
        !trimmed.includes("Could not read directory") &&
        !/^update_topic\s*\(/i.test(trimmed)
      );
    })
    .join("\n")
    .trim();
}

async function postSlack(agent, env, channel, text) {
  const token = env.SLACK_BOT_TOKEN;
  if (!token || !channel) {
    appendLog(`[${agent.name}] Rutina generada sin publicar: falta ${!token ? "SLACK_BOT_TOKEN" : "canal Slack"}.`);
    return false;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: String(text || "").slice(0, 39000),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(`Slack chat.postMessage fallo: ${data.error || response.statusText}`);
  }
  return true;
}

async function runColegaRoutine(agent, routineId, prompt, dryRun) {
  if (configValue("COLEGA_ROUTINE_MODE", "fallback").trim().toLowerCase() === "native") {
    return "Colega esta configurado con COLEGA_ROUTINE_MODE=native; la rutina debe salir por OpenClaw cron nativo.";
  }
  if (dryRun) return prompt;
  const sessionId = `colega-${routineId.replace(/[^a-z0-9_-]/gi, "-")}`;
  const output = await runCommand(
    "docker",
    ["exec", "colega", "openclaw", "agent", "--session-id", sessionId, "--message", prompt, "--thinking", "low", "--json"],
    { timeoutMs: 300000 },
  );
  return extractReply(output);
}

async function runCoachRoutine(agent, routineId, prompt, dryRun) {
  if (dryRun) return prompt;
  const output = await runCommand(
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
      routineId === "sunday_roundtable" ? "opus" : "sonnet",
      "--permission-mode",
      "bypassPermissions",
    ],
    { timeoutMs: routineId === "sunday_roundtable" ? 420000 : 300000 },
  );
  return extractReply(output);
}

async function runSocioRoutine(agent, routineId, channel, dryRun) {
  const prompt = routinePrompt(agent, routineId);
  if (dryRun) return prompt;
  const model = routineId === "sunday_roundtable" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const output = await runCommand(
    "docker",
    socioGeminiDockerArgs({ model, prompt, approvalMode: "yolo", outputFormat: "text" }),
    { timeoutMs: routineId === "sunday_roundtable" ? 420000 : 300000 },
  );
  return cleanAgentOutput(extractReply(output));
}

async function runRoutine(agentId, routineId, options = {}) {
  const agent = AGENTS[agentId];
  const routine = ROUTINES[routineId];
  if (!agent) throw new Error(`Agente no soportado: ${agentId}`);
  if (!routine) throw new Error(`Rutina no soportada: ${routineId}`);
  const lockAcquired = options.dryRun ? true : acquireRoutineLock(agent.id, routine.id);
  if (!lockAcquired) {
    appendLog(`[${agent.name}] ${routine.label} omitida: ya hay una ejecucion activa.`);
    return `${agent.name}: rutina ya esta en ejecucion.`;
  }

  try {
    if (agent.id === "colega" && configValue("COLEGA_ROUTINE_MODE", "fallback").trim().toLowerCase() === "native") {
    const logKey = `${agent.id}-${routine.id}`;
    writeState(agent.id, routine.id, {
      status: "native",
      currentRunDate: routineRunKey(routine.id),
      updatedAt: new Date().toISOString(),
      outputPreview: "Colega usa OpenClaw cron nativo; el orquestador local no dispara esta rutina.",
    });
    if (!nativeRoutineSkipLogged.has(logKey)) {
      appendLog(`[${agent.name}] ${routine.label} omitida: COLEGA_ROUTINE_MODE=native.`);
      nativeRoutineSkipLogged.add(logKey);
    }
    if (!options.dryRun) markRoutineRun(agent.id, routine.id);
    return "Colega usa OpenClaw cron nativo.";
  }

  if (agent.id === "socio" && configValue("SOCIO_ROUTINE_MODE", "daemon").trim().toLowerCase() === "daemon") {
    const logKey = `${agent.id}-${routine.id}`;
    writeState(agent.id, routine.id, {
      status: "daemon",
      currentRunDate: routineRunKey(routine.id),
      updatedAt: new Date().toISOString(),
      outputPreview: "Socio usa business_agent_daemon para rutinas; el orquestador local no dispara esta rutina.",
    });
    if (!nativeRoutineSkipLogged.has(logKey)) {
      appendLog(`[${agent.name}] ${routine.label} omitida: SOCIO_ROUTINE_MODE=daemon.`);
      nativeRoutineSkipLogged.add(logKey);
    }
    if (!options.dryRun) markRoutineRun(agent.id, routine.id);
    return "Socio usa daemon propio.";
  }

  const env = runtimeEnv(agent);
  const route = readLastSlackRoute(agent.id);
  const channel = resolveSlackChannel(agent.id, env);
  const prompt = routinePrompt(agent, routineId);

  if (!options.dryRun) {
    writeState(agent.id, routine.id, {
      status: "running",
      currentRunDate: routineRunKey(routine.id),
      startedAt: new Date().toISOString(),
      channel: channel || "",
      model: agent.defaultModel,
      error: "",
    });
    appendLog(`[${agent.name}] Ejecutando ${routine.label}.`);
  }

  try {
    let reply = "";
    let postedByAgent = false;
    if (agent.id === "colega") {
      reply = await runColegaRoutine(agent, routine.id, prompt, options.dryRun);
    } else if (agent.id === "coach") {
      reply = await runCoachRoutine(agent, routine.id, prompt, options.dryRun);
    } else {
      reply = await runSocioRoutine(agent, routine.id, channel, options.dryRun);
    }

    if (!postedByAgent && !options.dryRun) {
      await postSlack(agent, env, channel, reply);
      appendConversation(agent.id, {
        direction: "out",
        role: "assistant",
        agentName: agent.name,
        routine: routine.id,
        model: agent.defaultModel,
        channel: channel || route?.channel || "",
        user: route?.user || "",
        text: reply,
      });
    }
    if (options.dryRun) {
      console.log(`\n--- DRY RUN ${agent.name} / ${routine.id} ---\n${reply}\n`);
      return reply;
    }

    writeState(agent.id, routine.id, {
      status: "done",
      finishedAt: new Date().toISOString(),
      lastRunAt: new Date().toISOString(),
      lastRunLocal: currentBogotaText(),
      outputPreview: String(reply || "").slice(0, 1000),
    });
    if (!options.dryRun) markRoutineRun(agent.id, routine.id);
    return reply;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeState(agent.id, routine.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: message.slice(0, 1200),
    });
    appendLog(`[${agent.name}] Fallo ${routine.label}: ${message.slice(0, 500)}`);
    throw error;
  }
  } finally {
    if (!options.dryRun) releaseRoutineLock(agent.id, routine.id);
  }
}

async function runDueRoutines() {
  for (const agentId of Object.keys(AGENTS)) {
    for (const routineId of Object.keys(ROUTINES)) {
      if (!isRoutineDue(routineId, agentId)) continue;
      try {
        await runRoutine(agentId, routineId);
      } catch {
        // Error already logged in state.
      }
    }
  }
}

async function loop() {
  fs.writeFileSync(pidFile, String(process.pid), "utf8");
  appendLog(`Routine Orchestrator activo. PID ${process.pid}.`);

  const cleanup = () => {
    try {
      if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) {
        fs.rmSync(pidFile, { force: true });
      }
    } catch {
      // Best effort cleanup.
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  const intervalSeconds = Number(configValue("ROUTINE_LOOP_INTERVAL_SECONDS", "60"));
  while (true) {
    await runDueRoutines();
    await new Promise((resolve) => setTimeout(resolve, Math.max(15, intervalSeconds) * 1000));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.loop) {
    await loop();
    return;
  }

  if (!args.routine || !ROUTINES[args.routine]) {
    throw new Error("Usa --routine daily_improvement_plan|nightly_review|sunday_roundtable o --loop.");
  }

  const agentIds = args.agent === "all" ? Object.keys(AGENTS) : [args.agent];
  for (const agentId of agentIds) {
    await runRoutine(agentId, args.routine, { dryRun: args.dryRun });
  }
}

await main();


