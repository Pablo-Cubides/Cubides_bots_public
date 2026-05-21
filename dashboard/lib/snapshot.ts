import fs from "node:fs";
import path from "node:path";
import { agentDefinitions } from "./agents";
import { encryptedSecretPresence, envPresence, runtimeEnvPresence } from "./env";
import { repoRoot } from "./env";
import { deepResearchRunnerState, dockerState, routineOrchestratorState, slackBridgeState, tailLogs } from "./shell";
import type { AgentEvent, AgentSnapshot, AgentStatus, AvatarState, RuntimeInfo, SnapshotResponse } from "./types";

const emptyRuntime = (containerName: string): RuntimeInfo => ({
  containerName,
  dockerStatus: "No encontrado",
  dockerHealth: "unknown",
  running: false,
  ports: "",
});

async function checkHealth(url?: string): Promise<boolean | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch {
    return false;
  }
}

function deriveState(runtime: RuntimeInfo, healthOk: boolean | null): { status: AgentStatus; avatarState: AvatarState } {
  if (!runtime.running) return { status: "offline", avatarState: "error" };
  if (runtime.dockerHealth === "unhealthy" || healthOk === false) return { status: "error", avatarState: "error" };
  if (runtime.dockerHealth === "starting") return { status: "starting", avatarState: "walking" };
  if (runtime.dockerHealth === "healthy" || healthOk === true || runtime.running) return { status: "healthy", avatarState: "idle" };
  return { status: "warning", avatarState: "warning" };
}

function readRoutineStates() {
  const dir = path.join(repoRoot, "logs", "runtime", "routines", "state");
  if (!fs.existsSync(dir)) return [];
  const states = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      states.push({
        agentId: data.agentId,
        routineId: data.routineId,
        status: data.status || "unknown",
        updatedAt: data.updatedAt,
        lastRunLocal: data.lastRunLocal,
        error: data.error,
      });
    } catch {
      // Ignore corrupt local state files.
    }
  }
  return states;
}

function readColegaOpenClawCronState() {
  const filePath = path.join(repoRoot, "logs", "runtime", "routines", "colega-openclaw-cron.json");
  if (!fs.existsSync(filePath)) {
    return { configured: false, status: "Sin configurar" };
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      configured: Boolean(data.configured),
      status: data.configured ? "Configurado" : "Preview generado",
      updatedAt: data.updatedAt,
    };
  } catch {
    return { configured: false, status: "Estado ilegible" };
  }
}

export async function buildSnapshot(): Promise<SnapshotResponse> {
  const docker = await dockerState();
  const slackBridge = await slackBridgeState();
  const deepResearchRunner = await deepResearchRunnerState();
  const routineOrchestrator = await routineOrchestratorState();
  const routines = readRoutineStates();
  const colegaOpenClawCron = readColegaOpenClawCronState();
  const rootSecrets = envPresence(["DASHBOARD_ADMIN_TOKEN", "AGENT_ADMIN_TOKEN", "VNC_PASSWORD"]);
  const academicRuntimeSecrets = runtimeEnvPresence("colega.env", [
    "GMAIL_BOT_EMAIL",
    "GMAIL_BOT_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const academicEncryptedSecrets = encryptedSecretPresence("academic.enc.yaml", [
    "GMAIL_BOT_EMAIL",
    "GMAIL_BOT_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const personalSecrets = runtimeEnvPresence("personal.env", [
    "CLAUDE_CODE_OAUTH_TOKEN",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "COACH_GMAIL_EMAIL",
    "COACH_GMAIL_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const personalEncryptedSecrets = encryptedSecretPresence("personal.enc.yaml", [
    "COACH_GMAIL_EMAIL",
    "COACH_GMAIL_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const businessSecrets = runtimeEnvPresence("business.env", [
    "OPENROUTER_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "GOOGLE_ANALYTICS_KEY",
    "SOCIO_GMAIL_EMAIL",
    "SOCIO_GMAIL_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const businessEncryptedSecrets = encryptedSecretPresence("business.enc.yaml", [
    "SOCIO_GMAIL_EMAIL",
    "SOCIO_GMAIL_APP_PASSWORD",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CHANNEL_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
  ]);
  const combinePresence = (runtime: Record<string, boolean>, encrypted: Record<string, boolean>, key: string) => Boolean(runtime[key] || encrypted[key]);
  const secretPresence: Record<string, boolean> = {
    ...rootSecrets,
    academic_GMAIL_BOT_EMAIL: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "GMAIL_BOT_EMAIL"),
    academic_GMAIL_BOT_APP_PASSWORD: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "GMAIL_BOT_APP_PASSWORD"),
    academic_SLACK_BOT_TOKEN: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "SLACK_BOT_TOKEN"),
    academic_SLACK_APP_TOKEN: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "SLACK_APP_TOKEN"),
    academic_SLACK_CHANNEL_ID: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "SLACK_CHANNEL_ID"),
    academic_GOOGLE_CLIENT_ID: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "GOOGLE_CLIENT_ID"),
    academic_GOOGLE_CLIENT_SECRET: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "GOOGLE_CLIENT_SECRET"),
    academic_GOOGLE_REFRESH_TOKEN: combinePresence(academicRuntimeSecrets, academicEncryptedSecrets, "GOOGLE_REFRESH_TOKEN"),
    personal_CLAUDE_CODE_OAUTH_TOKEN: personalSecrets.CLAUDE_CODE_OAUTH_TOKEN,
    personal_OPENROUTER_API_KEY: personalSecrets.OPENROUTER_API_KEY,
    personal_ANTHROPIC_API_KEY: personalSecrets.ANTHROPIC_API_KEY,
    personal_COACH_GMAIL_EMAIL: combinePresence(personalSecrets, personalEncryptedSecrets, "COACH_GMAIL_EMAIL"),
    personal_COACH_GMAIL_APP_PASSWORD: combinePresence(personalSecrets, personalEncryptedSecrets, "COACH_GMAIL_APP_PASSWORD"),
    personal_SLACK_BOT_TOKEN: combinePresence(personalSecrets, personalEncryptedSecrets, "SLACK_BOT_TOKEN"),
    personal_SLACK_APP_TOKEN: combinePresence(personalSecrets, personalEncryptedSecrets, "SLACK_APP_TOKEN"),
    personal_SLACK_CHANNEL_ID: combinePresence(personalSecrets, personalEncryptedSecrets, "SLACK_CHANNEL_ID"),
    personal_GOOGLE_CLIENT_ID: combinePresence(personalSecrets, personalEncryptedSecrets, "GOOGLE_CLIENT_ID"),
    personal_GOOGLE_CLIENT_SECRET: combinePresence(personalSecrets, personalEncryptedSecrets, "GOOGLE_CLIENT_SECRET"),
    personal_GOOGLE_REFRESH_TOKEN: combinePresence(personalSecrets, personalEncryptedSecrets, "GOOGLE_REFRESH_TOKEN"),
    business_OPENROUTER_API_KEY: businessSecrets.OPENROUTER_API_KEY,
    business_TELEGRAM_BOT_TOKEN: businessSecrets.TELEGRAM_BOT_TOKEN,
    business_SOCIO_GMAIL_EMAIL: combinePresence(businessSecrets, businessEncryptedSecrets, "SOCIO_GMAIL_EMAIL"),
    business_SOCIO_GMAIL_APP_PASSWORD: combinePresence(businessSecrets, businessEncryptedSecrets, "SOCIO_GMAIL_APP_PASSWORD"),
    business_SLACK_BOT_TOKEN: combinePresence(businessSecrets, businessEncryptedSecrets, "SLACK_BOT_TOKEN"),
    business_SLACK_APP_TOKEN: combinePresence(businessSecrets, businessEncryptedSecrets, "SLACK_APP_TOKEN"),
    business_SLACK_CHANNEL_ID: combinePresence(businessSecrets, businessEncryptedSecrets, "SLACK_CHANNEL_ID"),
    business_GOOGLE_CLIENT_ID: combinePresence(businessSecrets, businessEncryptedSecrets, "GOOGLE_CLIENT_ID"),
    business_GOOGLE_CLIENT_SECRET: combinePresence(businessSecrets, businessEncryptedSecrets, "GOOGLE_CLIENT_SECRET"),
    business_GOOGLE_REFRESH_TOKEN: combinePresence(businessSecrets, businessEncryptedSecrets, "GOOGLE_REFRESH_TOKEN"),
  };
  const runtimeSecretPresence: Record<string, boolean> = {
    academic_GMAIL_BOT_EMAIL: academicRuntimeSecrets.GMAIL_BOT_EMAIL,
    academic_GMAIL_BOT_APP_PASSWORD: academicRuntimeSecrets.GMAIL_BOT_APP_PASSWORD,
    academic_SLACK_BOT_TOKEN: academicRuntimeSecrets.SLACK_BOT_TOKEN,
    academic_SLACK_APP_TOKEN: academicRuntimeSecrets.SLACK_APP_TOKEN,
    academic_SLACK_CHANNEL_ID: academicRuntimeSecrets.SLACK_CHANNEL_ID,
    academic_GOOGLE_CLIENT_ID: academicRuntimeSecrets.GOOGLE_CLIENT_ID,
    academic_GOOGLE_CLIENT_SECRET: academicRuntimeSecrets.GOOGLE_CLIENT_SECRET,
    academic_GOOGLE_REFRESH_TOKEN: academicRuntimeSecrets.GOOGLE_REFRESH_TOKEN,
    personal_COACH_GMAIL_EMAIL: personalSecrets.COACH_GMAIL_EMAIL,
    personal_COACH_GMAIL_APP_PASSWORD: personalSecrets.COACH_GMAIL_APP_PASSWORD,
    personal_SLACK_BOT_TOKEN: personalSecrets.SLACK_BOT_TOKEN,
    personal_SLACK_APP_TOKEN: personalSecrets.SLACK_APP_TOKEN,
    personal_SLACK_CHANNEL_ID: personalSecrets.SLACK_CHANNEL_ID,
    personal_GOOGLE_CLIENT_ID: personalSecrets.GOOGLE_CLIENT_ID,
    personal_GOOGLE_CLIENT_SECRET: personalSecrets.GOOGLE_CLIENT_SECRET,
    personal_GOOGLE_REFRESH_TOKEN: personalSecrets.GOOGLE_REFRESH_TOKEN,
    business_SOCIO_GMAIL_EMAIL: businessSecrets.SOCIO_GMAIL_EMAIL,
    business_SOCIO_GMAIL_APP_PASSWORD: businessSecrets.SOCIO_GMAIL_APP_PASSWORD,
    business_SLACK_BOT_TOKEN: businessSecrets.SLACK_BOT_TOKEN,
    business_SLACK_APP_TOKEN: businessSecrets.SLACK_APP_TOKEN,
    business_SLACK_CHANNEL_ID: businessSecrets.SLACK_CHANNEL_ID,
    business_GOOGLE_CLIENT_ID: businessSecrets.GOOGLE_CLIENT_ID,
    business_GOOGLE_CLIENT_SECRET: businessSecrets.GOOGLE_CLIENT_SECRET,
    business_GOOGLE_REFRESH_TOKEN: businessSecrets.GOOGLE_REFRESH_TOKEN,
  };

  const agents: AgentSnapshot[] = [];
  const events: AgentEvent[] = [];

  for (const definition of agentDefinitions) {
    const runtime = docker.get(definition.container) || emptyRuntime(definition.container);
    const runtimeDetails = [runtime, ...(definition.secondaryContainers || []).map((container) => docker.get(container) || emptyRuntime(container))];
    const healthOk = await checkHealth(definition.healthUrl);
    const derived = deriveState(runtime, healthOk);
    const error =
      derived.status === "error"
        ? {
            code: healthOk === false ? "health_check_failed" : "runtime_unhealthy",
            message: healthOk === false ? "El endpoint de salud no responde correctamente." : "Docker reporta el contenedor como unhealthy.",
            source: (healthOk === false ? "health" : "runtime") as "health" | "runtime",
          }
        : undefined;

    agents.push({
      id: definition.id,
      name: definition.name,
      alias: definition.alias,
      role: definition.role,
      status: derived.status,
      avatarState: derived.avatarState,
      currentModel: definition.currentModel,
      healthUrl: definition.healthUrl,
      localUrl: definition.localUrl,
      runtime,
      runtimeDetails,
      error,
      channels: definition.channels.map((channel) => {
        const hasRequiredSecrets = channel.requiredSecrets?.every((key) => secretPresence[key]);
        const hasRuntimeSecrets = channel.requiredSecrets?.every((key) => runtimeSecretPresence[key] ?? secretPresence[key]);
        const heavyRunning = docker.get("business_agent_heavy")?.running;
        const slackReady = channel.type === "slack" ? slackBridge.running : true;
        return {
          ...channel,
          status:
            channel.type === "slack" && hasRequiredSecrets && hasRuntimeSecrets && !slackReady
              ? "configured"
              : (hasRequiredSecrets && hasRuntimeSecrets && slackReady) || (channel.type === "heavy_vnc" && heavyRunning)
                ? "active"
                : hasRequiredSecrets
                  ? "configured"
                  : channel.url && runtime.running
                    ? "active"
                    : channel.status,
        };
      }),
      actions: definition.actions,
      metrics: definition.metrics,
    });

    events.push({
      id: `${definition.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: definition.id,
      severity: derived.status === "error" ? "error" : derived.status === "offline" ? "warning" : "success",
      message: `${definition.name}: ${runtime.dockerStatus}`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    protected: rootSecrets.DASHBOARD_ADMIN_TOKEN || rootSecrets.AGENT_ADMIN_TOKEN,
    tokenSources: {
      dashboardAdminToken: rootSecrets.DASHBOARD_ADMIN_TOKEN,
      agentAdminToken: rootSecrets.AGENT_ADMIN_TOKEN,
      vncPassword: rootSecrets.VNC_PASSWORD,
    },
    secretPresence,
    integrations: {
      slackBridge: {
        ...slackBridge,
        logPath: "logs/slack-bridge.log",
      },
      deepResearchRunner: {
        ...deepResearchRunner,
        logPath: "logs/deep-research-runner.log",
      },
      routineOrchestrator: {
        ...routineOrchestrator,
        logPath: "logs/routine-orchestrator.log",
      },
      colegaOpenClawCron,
    },
    routines,
    agents,
    events,
    modelUsage: [
      { model: "OpenClaw routing", calls: 38, inputTokens: 92000, outputTokens: 21000, estimatedUsd: 2.8 },
      { model: "Claude Code OAuth", calls: 27, inputTokens: 76000, outputTokens: 18000, estimatedUsd: 2.1 },
      { model: "gemini-2.5-pro", calls: 55, inputTokens: 146000, outputTokens: 39200, estimatedUsd: 4.6 },
    ],
  };
}

export async function agentLogs(agentId: string): Promise<string> {
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  if (!definition) return "Agente no encontrado.";
  if (agentId === "socio") {
    const apiLogs = await tailLogs("business_agent", 80);
    const daemonLogs = await tailLogs("business_agent_daemon", 80);
    const heavyLogs = await tailLogs("business_agent_heavy", 80);
    return `# business_agent\n${apiLogs}\n\n# business_agent_daemon\n${daemonLogs}\n\n# business_agent_heavy\n${heavyLogs}`;
  }
  return tailLogs(definition.container, 120);
}


