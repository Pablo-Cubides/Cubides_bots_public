import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendConversation } from "./slack_memory.mjs";
import { socioGeminiDockerArgs } from "./socio_runtime.mjs";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const queueRoot = path.join(repoRoot, ".tmp", "deep-research");
const jobsDir = path.join(queueRoot, "jobs");
const stateDir = path.join(queueRoot, "state");
const logsDir = path.join(repoRoot, "logs");
const logFile = path.join(logsDir, "deep-research-runner.log");
const pidFile = path.join(queueRoot, "runner.pid");
const lockFile = path.join(queueRoot, "runner.lock");

const AGENTS = {
  colega: {
    label: "Colega",
    model: "deep / gpt-5.3-codex",
    categories: ["Docencia", "Investigacion", "Congresos_Convocatorias", "Papers_Bibliografia", "Marca_Academica", "Clases_Presentaciones"],
  },
  coach: {
    label: "Coach",
    model: "opus",
    categories: ["Salud", "Relaciones", "Freelance_Tecnico", "Habitos", "Stack_Agentes", "Planes_Visuales"],
  },
  socio: {
    label: "Socio",
    model: "pro",
    categories: ["Project_Alpha", "Project Beta", "Project_Gamma", "Mercado_Competencia", "Marketing_SEO", "Pitch_Decks"],
  },
};

const DEEP_RESEARCH_INSTRUCTIONS = `
Ejecuta una investigacion profunda en espanol.

Formato obligatorio:
# Titulo

## Resumen ejecutivo
## Pregunta investigada
## Plan de investigacion
## Hallazgos clave
## Fuentes y citas
## Riesgos e incertidumbre
## Recomendaciones
## Acciones sugeridas
## Memoria que debe conservarse

Reglas:
- Separa hechos, inferencias y recomendaciones.
- Si no puedes navegar o verificar fuentes, dilo claramente.
- Prioriza fuentes primarias y datos verificables.
- No imprimas secretos, tokens, passwords ni variables sensibles.
- Produce un reporte completo, no una respuesta de chat corta.
`.trim();

function ensureDirs() {
  for (const dir of [jobsDir, stateDir, logsDir]) fs.mkdirSync(dir, { recursive: true });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = "true";
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function log(message) {
  ensureDirs();
  const line = `[${new Date().toISOString()}] ${message}\n`;
  let written = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.appendFileSync(logFile, line, "utf8");
      written = true;
      break;
    } catch (error) {
      if (error?.code !== "EBUSY") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
    }
  }
  if (!written) {
    console.warn(`[deep-research-runner] log file busy; skipped file write for: ${message}`);
  }
  console.log(line.trimEnd());
}

function isProcessAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return false;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireRunnerLock() {
  ensureDirs();
  try {
    const fd = fs.openSync(lockFile, "wx");
    fs.writeFileSync(fd, String(process.pid), "utf8");
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existingPid = "";
    try {
      existingPid = fs.readFileSync(lockFile, "utf8").trim();
    } catch {
      // fall through to stale cleanup
    }
    if (isProcessAlive(existingPid)) {
      console.log(`Deep Research Runner ya esta activo (PID ${existingPid}).`);
      return false;
    }
    fs.rmSync(lockFile, { force: true });
    return acquireRunnerLock();
  }
}

function releaseRunnerLock() {
  try {
    if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, "utf8").trim() === String(process.pid)) {
      fs.rmSync(lockFile, { force: true });
    }
  } catch {
    // best effort
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeId(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_.:-]/g, "-")
    .slice(0, 120);
}

function statePath(jobId) {
  return path.join(stateDir, `${safeId(jobId)}.json`);
}

function updateState(job, patch) {
  const state = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeJson(statePath(job.id), state);
  return state;
}

function validateJob(job) {
  if (!job || typeof job !== "object") throw new Error("Job invalido.");
  if (!AGENTS[job.agent]) throw new Error("Job invalido: agent debe ser colega|coach|socio.");
  if (!job.prompt || typeof job.prompt !== "string") throw new Error("Job invalido: prompt requerido.");
  if (job.prompt.length > 12000) throw new Error("Job invalido: prompt demasiado largo.");
  const category = job.category || defaultCategory(job.agent);
  if (!AGENTS[job.agent].categories.includes(category)) throw new Error(`Categoria invalida para ${job.agent}: ${category}`);
  return {
    id: safeId(job.id || `${Date.now()}-${job.agent}`),
    agent: job.agent,
    prompt: job.prompt,
    title: job.title || `Investigacion profunda ${new Date().toISOString().slice(0, 10)}`,
    category,
    createSlides: Boolean(job.createSlides),
    emailTo: typeof job.emailTo === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.emailTo) ? job.emailTo : null,
    slack: job.slack || null,
    source: job.source || "manual",
    createdAt: job.createdAt || new Date().toISOString(),
  };
}

function defaultCategory(agent) {
  if (agent === "colega") return "Investigacion";
  if (agent === "coach") return "Stack_Agentes";
  return "Mercado_Competencia";
}

function wantsSlides(text) {
  return /\b(slides|presentaci[oó]n|diapositivas|pitch|deck|clase|exponer|visual)\b/i.test(text || "");
}

async function runCommand(file, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(file, args, {
    cwd: repoRoot,
    timeout: options.timeoutMs || 900000,
    maxBuffer: 1024 * 1024 * 12,
    windowsHide: true,
    env: options.env || process.env,
  });
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

function extractJsonText(value) {
  if (!value || typeof value !== "object") return "";
  for (const key of ["reply", "text", "content", "message", "output", "result"]) {
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

function normalizeAgentOutput(text) {
  const clean = String(text || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("Warning:") && !trimmed.includes("Could not read directory");
    })
    .join("\n")
    .trim();
  try {
    const parsed = JSON.parse(clean);
    return extractJsonText(parsed) || clean;
  } catch {
    return clean;
  }
}

function buildPrompt(job) {
  return `${DEEP_RESEARCH_INSTRUCTIONS}

Agente: ${AGENTS[job.agent].label}
Categoria: ${job.category}
Titulo sugerido: ${job.title}

Entrega externa:
- Tu tarea es producir el reporte de investigacion en Markdown.
- No digas que no tienes Drive, Docs, Slack o correo.
- No intentes explicar limitaciones de subida/envio: este runner creara el Google Doc y enviara el correo despues de tu reporte.
- No incluyas rutas locales como entrega final salvo que sean evidencia tecnica indispensable.

Solicitud original:
${job.prompt}`;
}

async function runColega(job) {
  const sessionId = `deep-research-${job.id}`;
  await runCommand("docker", ["exec", "colega", "openclaw", "agent", "--session-id", sessionId, "--message", "/model deep", "--thinking", "low", "--json"], { timeoutMs: 120000 });
  const output = await runCommand("docker", ["exec", "colega", "openclaw", "agent", "--session-id", sessionId, "--message", buildPrompt(job), "--thinking", "low", "--json"], { timeoutMs: 1200000 });
  return normalizeAgentOutput(output);
}

async function runCoach(job) {
  const output = await runCommand(
    "docker",
    ["exec", "-w", "/home/claude/workspace/personal_agent", "personal", "claude", "-p", buildPrompt(job), "--model", "opus", "--permission-mode", "bypassPermissions"],
    { timeoutMs: 1200000 },
  );
  return normalizeAgentOutput(output);
}

async function runSocio(job) {
  const output = await runCommand(
    "docker",
    socioGeminiDockerArgs({ model: "pro", prompt: buildPrompt(job), approvalMode: "yolo", outputFormat: "text" }),
    { timeoutMs: 1200000 },
  );
  return normalizeAgentOutput(output);
}

async function runAgent(job) {
  if (job.agent === "colega") return runColega(job);
  if (job.agent === "coach") return runCoach(job);
  return runSocio(job);
}

function summaryFromReport(report) {
  const lines = String(report || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return lines.slice(0, 8).join("\n").slice(0, 1400);
}

async function createWorkspaceArtifacts(job, report) {
  const bodyFile = path.join(queueRoot, `${job.id}.report.md`);
  fs.writeFileSync(bodyFile, report, "utf8");

  const docRaw = await runCommand("node", [
    path.join(repoRoot, "agent_tools", "google_workspace.mjs"),
    "--agent",
    job.agent,
    "--action",
    "create-doc",
    "--title",
    job.title,
    "--category",
    job.category,
    "--body-file",
    bodyFile,
  ]);
  const doc = JSON.parse(docRaw).doc;

  let slides = null;
  if (job.createSlides || wantsSlides(job.prompt)) {
    const slidesRaw = await runCommand("node", [
      path.join(repoRoot, "agent_tools", "google_workspace.mjs"),
      "--agent",
      job.agent,
      "--action",
      "create-slides",
      "--title",
      `${job.title} - Slides`,
      "--category",
      job.category,
      "--body-file",
      bodyFile,
    ]);
    slides = JSON.parse(slidesRaw).slides;
  }

  return { doc, slides };
}

async function verifyWorkspace(agent) {
  await runCommand("node", [
    path.join(repoRoot, "agent_tools", "google_workspace.mjs"),
    "--agent",
    agent,
    "--action",
    "verify",
  ], { timeoutMs: 120000 });
}

function slackTokenFor(agent) {
  return runtimeEnvForAgent(agent).SLACK_BOT_TOKEN || null;
}

function runtimeEnvForAgent(agent) {
  const envFile = agent === "colega" ? "colega.env" : agent === "coach" ? "personal.env" : "business.env";
  const filePath = path.join(repoRoot, "secrets", "runtime", envFile);
  if (!fs.existsSync(filePath)) return {};
  const env = { ...process.env };
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

async function postSlackCompletion(job, artifacts, report, emailError = null) {
  if (!job.slack?.channel || !job.slack?.thread_ts) return;
  const token = slackTokenFor(job.agent);
  if (!token) return;
  const text = [
    `${AGENTS[job.agent].label} termino la investigacion profunda.`,
    "",
    summaryFromReport(report),
    "",
    `Documento: ${artifacts.doc.webViewLink}`,
    artifacts.slides ? `Slides: ${artifacts.slides.webViewLink}` : "",
    emailError ? `Correo: no se pudo enviar automaticamente (${emailError}).` : "",
  ].filter(Boolean).join("\n");

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: job.slack.channel, thread_ts: job.slack.thread_ts, text }),
  });
  appendConversation(job.agent, {
    direction: "out",
    role: "assistant",
    agentName: AGENTS[job.agent].label,
    routine: "deep_research",
    model: AGENTS[job.agent].model,
    channel: job.slack.channel,
    thread_ts: job.slack.thread_ts,
    text,
  });
}

async function sendEmailCompletion(job, artifacts, report) {
  if (!job.emailTo) return null;
  const bodyFile = path.join(queueRoot, `${job.id}.email.txt`);
  const body = [
    `${AGENTS[job.agent].label} termino la investigacion profunda.`,
    "",
    summaryFromReport(report),
    "",
    `Documento: ${artifacts.doc.webViewLink}`,
    artifacts.slides ? `Slides: ${artifacts.slides.webViewLink}` : "",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(bodyFile, body, "utf8");
  await runCommand("node", [
    path.join(repoRoot, "agent_tools", "send_agent_mail.mjs"),
    "--agent",
    job.agent,
    "--to",
    job.emailTo,
    "--subject",
    `[${AGENTS[job.agent].label}] investigacion profunda lista`,
    "--body-file",
    bodyFile,
  ], {
    timeoutMs: 120000,
    env: runtimeEnvForAgent(job.agent),
  });
  return job.emailTo;
}

async function processJobFile(filePath) {
  const raw = readJson(filePath);
  const job = validateJob(raw);
  log(`Job ${job.id} iniciado (${job.agent})`);
  updateState(job, { status: "running", startedAt: new Date().toISOString(), model: AGENTS[job.agent].model });
  try {
    updateState(job, { status: "preflight", stage: "google-workspace" });
    await verifyWorkspace(job.agent);
    updateState(job, { status: "running", stage: "agent-research" });
    const report = await runAgent(job);
    updateState(job, { status: "running", stage: "workspace-artifacts" });
    const artifacts = await createWorkspaceArtifacts(job, report);
    let emailedTo = null;
    let emailError = null;
    try {
      emailedTo = await sendEmailCompletion(job, artifacts, report);
    } catch (error) {
      emailError = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
      log(`Job ${job.id} correo fallo: ${emailError}`);
    }
    await postSlackCompletion(job, artifacts, report, emailError);
    updateState(job, {
      status: "done",
      completedAt: new Date().toISOString(),
      docUrl: artifacts.doc.webViewLink,
      slidesUrl: artifacts.slides?.webViewLink || null,
      emailedTo,
      emailError,
      summary: summaryFromReport(report),
    });
    fs.rmSync(filePath, { force: true });
    log(`Job ${job.id} completado.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateState(job, { status: "failed", failedAt: new Date().toISOString(), error: message.slice(0, 1200) });
    fs.rmSync(filePath, { force: true });
    log(`Job ${job.id} fallo: ${message.slice(0, 500)}`);
  }
}

async function runOnce() {
  ensureDirs();
  const files = fs.readdirSync(jobsDir).filter((name) => name.endsWith(".json")).sort();
  for (const file of files) {
    await processJobFile(path.join(jobsDir, file));
  }
}

async function runLoop() {
  ensureDirs();
  if (!acquireRunnerLock()) return;
  fs.writeFileSync(pidFile, String(process.pid), "utf8");
  log(`Runner activo PID ${process.pid}`);
  process.on("exit", () => {
    try {
      if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) fs.rmSync(pidFile, { force: true });
    } catch {
      // best effort
    }
    releaseRunnerLock();
  });
  while (true) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function enqueue(args) {
  ensureDirs();
  const job = validateJob({
    id: args.id || `${Date.now()}-${args.agent}`,
    agent: args.agent,
    title: args.title,
    category: args.category,
    prompt: args.prompt || (args["prompt-file"] ? fs.readFileSync(args["prompt-file"], "utf8") : ""),
    createSlides: args["create-slides"] === "true" || args.slides === "true",
    emailTo: args.emailTo || args["email-to"] || null,
    source: args.source || "manual",
  });
  updateState(job, { status: "queued" });
  const filePath = path.join(jobsDir, `${job.id}.json`);
  writeJson(filePath, job);
  console.log(JSON.stringify({ ok: true, jobId: job.id, statePath: statePath(job.id) }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.enqueue === "true") return enqueue(args);
  if (args.once === "true") return runOnce();
  return runLoop();
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


