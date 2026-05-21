import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "./env";
import { redact } from "./security";
import type { ActionResponse, AgentAction, AgentId, RuntimeInfo } from "./types";

const execFileAsync = promisify(execFile);

type AllowedCommand = {
  label: string;
  command: string;
  timeoutMs?: number;
};

export type ProcessState = {
  running: boolean;
  status: string;
  processIds: number[];
};

const commands: Record<AgentId, Partial<Record<AgentAction, AllowedCommand>>> = {
  colega: {
    start: { label: "Levantar Colega", command: ".\\scripts\\start-academic.ps1", timeoutMs: 180000 },
    stop: { label: "Detener Colega", command: "docker compose stop colega", timeoutMs: 60000 },
    restart: { label: "Reiniciar Colega", command: "docker compose restart colega", timeoutMs: 90000 },
    queue_daily: { label: "Rutina diaria Colega", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent colega -Routine daily_improvement_plan", timeoutMs: 30000 },
    queue_nightly: { label: "Rutina nocturna Colega", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent colega -Routine nightly_review", timeoutMs: 30000 },
    queue_sunday: { label: "Reunion dominical Colega", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent colega -Routine sunday_roundtable", timeoutMs: 30000 },
    audit_models: { label: "Auditar modelos pro", command: ".\\scripts\\audit-model-access.ps1 -ProOnly", timeoutMs: 120000 },
    discover_models: { label: "Descubrir modelos", command: ".\\scripts\\discover-model-access.ps1", timeoutMs: 180000 },
    logs: { label: "Logs Colega", command: "docker logs --tail 120 colega", timeoutMs: 30000 },
  },
  coach: {
    start: { label: "Levantar Coach", command: ".\\scripts\\start-personal.ps1 -NoAttach", timeoutMs: 240000 },
    stop: { label: "Detener Coach", command: "docker compose stop personal", timeoutMs: 60000 },
    restart: { label: "Reiniciar Coach", command: "docker compose up -d personal", timeoutMs: 120000 },
    validate: { label: "Validar Coach", command: ".\\scripts\\validate-personal.ps1", timeoutMs: 60000 },
    queue_daily: { label: "Rutina diaria Coach", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent coach -Routine daily_improvement_plan", timeoutMs: 30000 },
    queue_nightly: { label: "Rutina nocturna Coach", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent coach -Routine nightly_review", timeoutMs: 30000 },
    queue_sunday: { label: "Reunion dominical Coach", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent coach -Routine sunday_roundtable", timeoutMs: 30000 },
    audit_models: { label: "Auditar modelos pro", command: ".\\scripts\\audit-model-access.ps1 -ProOnly", timeoutMs: 120000 },
    discover_models: { label: "Descubrir modelos", command: ".\\scripts\\discover-model-access.ps1", timeoutMs: 180000 },
    logs: { label: "Logs Coach", command: "docker logs --tail 120 personal", timeoutMs: 30000 },
  },
  socio: {
    start: { label: "Levantar Socio Lite", command: ".\\scripts\\start-business.ps1 -NoBuild", timeoutMs: 180000 },
    stop: { label: "Detener Socio Lite", command: "docker compose stop business_agent business_agent_daemon", timeoutMs: 60000 },
    restart: { label: "Reiniciar Socio Lite", command: "docker compose up -d business_agent business_agent_daemon", timeoutMs: 120000 },
    start_heavy: { label: "Levantar Socio Heavy", command: "docker compose --profile heavy up -d business_agent_heavy", timeoutMs: 180000 },
    stop_heavy: { label: "Detener Socio Heavy", command: "docker compose --profile heavy stop business_agent_heavy", timeoutMs: 60000 },
    restart_heavy: { label: "Reiniciar Socio Heavy", command: "docker compose --profile heavy up -d business_agent_heavy", timeoutMs: 180000 },
    rebuild_heavy: { label: "Reconstruir Socio Heavy", command: "docker compose --profile heavy up -d --build business_agent_heavy", timeoutMs: 900000 },
    validate: { label: "Validar Socio Lite", command: "docker compose ps business_agent business_agent_daemon", timeoutMs: 30000 },
    queue_daily: { label: "Rutina diaria Socio", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent socio -Routine daily_improvement_plan", timeoutMs: 30000 },
    queue_nightly: { label: "Rutina nocturna Socio", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent socio -Routine nightly_review", timeoutMs: 30000 },
    queue_sunday: { label: "Reunion dominical Socio", command: ".\\scripts\\invoke-agent-routine.ps1 -Agent socio -Routine sunday_roundtable", timeoutMs: 30000 },
    audit_models: { label: "Auditar modelos pro", command: ".\\scripts\\audit-model-access.ps1 -ProOnly", timeoutMs: 120000 },
    discover_models: { label: "Descubrir modelos", command: ".\\scripts\\discover-model-access.ps1", timeoutMs: 180000 },
    start_slack_bridge: { label: "Levantar Slack Bridge", command: ".\\scripts\\start-slack-bridge.ps1 -Detached", timeoutMs: 180000 },
    stop_slack_bridge: { label: "Detener Slack Bridge", command: ".\\scripts\\start-slack-bridge.ps1 -Stop", timeoutMs: 60000 },
    slack_bridge_logs: { label: "Logs Slack Bridge", command: "if (Test-Path .\\logs\\slack-bridge.log) { Get-Content .\\logs\\slack-bridge.log -Tail 120 } else { 'Sin logs de Slack Bridge todavia.' }", timeoutMs: 30000 },
    start_deep_research_runner: { label: "Levantar Deep Research Runner", command: ".\\scripts\\start-deep-research-runner.ps1 -Detached", timeoutMs: 60000 },
    stop_deep_research_runner: { label: "Detener Deep Research Runner", command: ".\\scripts\\start-deep-research-runner.ps1 -Stop", timeoutMs: 60000 },
    deep_research_runner_logs: { label: "Logs Deep Research Runner", command: "if (Test-Path .\\logs\\deep-research-runner.log) { Get-Content .\\logs\\deep-research-runner.log -Tail 120 } else { 'Sin logs de Deep Research Runner todavia.' }", timeoutMs: 30000 },
    start_routine_orchestrator: { label: "Levantar Routine Orchestrator", command: ".\\scripts\\start-routine-orchestrator.ps1 -Detached", timeoutMs: 60000 },
    stop_routine_orchestrator: { label: "Detener Routine Orchestrator", command: ".\\scripts\\start-routine-orchestrator.ps1 -Stop", timeoutMs: 60000 },
    routine_orchestrator_logs: { label: "Logs Routine Orchestrator", command: "if (Test-Path .\\logs\\routine-orchestrator.log) { Get-Content .\\logs\\routine-orchestrator.log -Tail 120 } else { 'Sin logs de Routine Orchestrator todavia.' }", timeoutMs: 30000 },
    setup_colega_cron_preview: { label: "Preview Cron OpenClaw Colega", command: ".\\scripts\\setup-colega-openclaw-cron.ps1", timeoutMs: 60000 },
    logs: { label: "Logs Socio Lite", command: "docker logs --tail 120 business_agent", timeoutMs: 30000 },
  },
};

export async function runPowerShell(command: string, timeoutMs = 120000): Promise<string> {
  const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const { stdout, stderr } = await execFileAsync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    cwd: repoRoot,
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 4,
    windowsHide: true,
  });
  return redact([stdout, stderr].filter(Boolean).join("\n").trim());
}

export async function runAgentAction(agentId: AgentId, action: AgentAction): Promise<ActionResponse> {
  const command = commands[agentId]?.[action];
  if (!command) {
    return { ok: false, commandLabel: "Accion no permitida", output: `La accion ${action} no esta permitida para ${agentId}.` };
  }

  try {
    const output = await runPowerShell(command.command, command.timeoutMs);
    return { ok: true, commandLabel: command.label, output: output || "Comando completado sin salida." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, commandLabel: command.label, output: redact(message) };
  }
}

export async function dockerState(): Promise<Map<string, RuntimeInfo>> {
  try {
    const output = await runPowerShell('docker ps -a --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"', 30000);
    const map = new Map<string, RuntimeInfo>();

    for (const line of output.split(/\r?\n/)) {
      const [name, status = "", ports = ""] = line.split("\t");
      if (!name) continue;
      const lower = status.toLowerCase();
      let health: RuntimeInfo["dockerHealth"] = "none";
      if (lower.includes("healthy")) health = "healthy";
      if (lower.includes("unhealthy")) health = "unhealthy";
      if (lower.includes("health: starting")) health = "starting";
      map.set(name, {
        containerName: name,
        dockerStatus: status,
        dockerHealth: health,
        running: lower.startsWith("up"),
        ports,
      });
    }

    return map;
  } catch {
    return new Map();
  }
}

export async function tailLogs(container: string, lines = 120): Promise<string> {
  try {
    return await runPowerShell(`docker logs --tail ${lines} ${container}`, 30000);
  } catch (error) {
    return redact(error instanceof Error ? error.message : String(error));
  }
}

export async function slackBridgeState(): Promise<ProcessState> {
  try {
    const output = await runPowerShell(
      "$pidFile = Join-Path (Get-Location) '.tmp\\slack-bridge.pid'; if (Test-Path $pidFile) { $pid = [int]((Get-Content $pidFile -Raw).Trim()); $p = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($p) { $pid } }",
      30000,
    );
    const processIds = output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      running: processIds.length > 0,
      status: processIds.length > 0 ? `Activo (${processIds.length} proceso${processIds.length === 1 ? "" : "s"})` : "Apagado",
      processIds,
    };
  } catch {
    return { running: false, status: "Desconocido", processIds: [] };
  }
}

export async function deepResearchRunnerState(): Promise<ProcessState> {
  try {
    const output = await runPowerShell(
      "$pidFile = Join-Path (Get-Location) '.tmp\\deep-research\\runner.pid'; if (Test-Path $pidFile) { $pid = [int]((Get-Content $pidFile -Raw).Trim()); $p = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($p) { $pid } }",
      30000,
    );
    const processIds = output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      running: processIds.length > 0,
      status: processIds.length > 0 ? `Activo (${processIds.length} proceso${processIds.length === 1 ? "" : "s"})` : "Apagado",
      processIds,
    };
  } catch {
    return { running: false, status: "Desconocido", processIds: [] };
  }
}

export async function routineOrchestratorState(): Promise<ProcessState> {
  try {
    const output = await runPowerShell(
      "$pidFile = Join-Path (Get-Location) 'logs\\runtime\\routines\\orchestrator.pid'; if (Test-Path $pidFile) { $pid = [int]((Get-Content $pidFile -Raw).Trim()); $p = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($p) { $pid } }",
      30000,
    );
    const processIds = output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      running: processIds.length > 0,
      status: processIds.length > 0 ? `Activo (${processIds.length} proceso${processIds.length === 1 ? "" : "s"})` : "Apagado",
      processIds,
    };
  } catch {
    return { running: false, status: "Desconocido", processIds: [] };
  }
}


