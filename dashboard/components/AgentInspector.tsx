"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { BrainCircuit, CalendarClock, ClipboardList, ExternalLink, FileText, Hammer, MessageSquare, Play, RefreshCw, Send, ShieldCheck, Square, Terminal } from "lucide-react";
import type { AgentAction, AgentSnapshot } from "@/lib/types";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";
import { dotClasses, statusClasses, statusLabel } from "./status";

const actionIcon: Partial<Record<AgentAction, ReactNode>> = {
  start: <Play className="h-4 w-4" />,
  stop: <Square className="h-4 w-4" />,
  restart: <RefreshCw className="h-4 w-4" />,
  rebuild: <Hammer className="h-4 w-4" />,
  validate: <ShieldCheck className="h-4 w-4" />,
  queue_daily: <ClipboardList className="h-4 w-4" />,
  queue_nightly: <CalendarClock className="h-4 w-4" />,
  queue_sunday: <CalendarClock className="h-4 w-4" />,
  start_heavy: <Play className="h-4 w-4" />,
  stop_heavy: <Square className="h-4 w-4" />,
  restart_heavy: <RefreshCw className="h-4 w-4" />,
  rebuild_heavy: <Hammer className="h-4 w-4" />,
  audit_models: <BrainCircuit className="h-4 w-4" />,
  discover_models: <BrainCircuit className="h-4 w-4" />,
  start_slack_bridge: <MessageSquare className="h-4 w-4" />,
  stop_slack_bridge: <Square className="h-4 w-4" />,
  slack_bridge_logs: <FileText className="h-4 w-4" />,
  start_deep_research_runner: <BrainCircuit className="h-4 w-4" />,
  stop_deep_research_runner: <Square className="h-4 w-4" />,
  deep_research_runner_logs: <FileText className="h-4 w-4" />,
  start_routine_orchestrator: <CalendarClock className="h-4 w-4" />,
  stop_routine_orchestrator: <Square className="h-4 w-4" />,
  routine_orchestrator_logs: <FileText className="h-4 w-4" />,
  setup_colega_cron_preview: <CalendarClock className="h-4 w-4" />,
  logs: <FileText className="h-4 w-4" />,
  open: <ExternalLink className="h-4 w-4" />,
};

function ActionButton({ agent, action }: { agent: AgentSnapshot; action: AgentAction }) {
  const runAction = useCommandCenterStore((state) => state.runAction);
  const loadLogs = useCommandCenterStore((state) => state.loadLogs);
  const fetchModelDiscovery = useCommandCenterStore((state) => state.fetchModelDiscovery);

  const onClick = async () => {
    if (action === "open" && agent.localUrl) {
      window.open(agent.localUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "logs") {
      await loadLogs(agent.id);
      return;
    }
    if (action === "discover_models") {
      await fetchModelDiscovery();
      return;
    }
    if ((action === "rebuild" || action === "rebuild_heavy" || action === "stop" || action === "stop_heavy") && !window.confirm(`Confirmar accion ${action} para ${agent.name}`)) return;
    await runAction(agent.id, action);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/10"
    >
      {actionIcon[action]}
      {action === "audit_models"
        ? "modelos pro"
        : action === "discover_models"
          ? "disponibles"
          : action === "queue_daily"
            ? "mañana"
            : action === "queue_nightly"
              ? "noche"
              : action === "queue_sunday"
                ? "domingo"
              : action === "start_heavy"
                ? "heavy on"
                : action === "stop_heavy"
                  ? "heavy off"
                  : action === "restart_heavy"
                    ? "heavy restart"
                    : action === "rebuild_heavy"
                      ? "rebuild heavy"
                      : action === "start_slack_bridge"
                        ? "slack on"
                        : action === "stop_slack_bridge"
                          ? "slack off"
                          : action === "slack_bridge_logs"
                            ? "slack logs"
                            : action === "start_deep_research_runner"
                              ? "research on"
                              : action === "stop_deep_research_runner"
                                ? "research off"
                                : action === "deep_research_runner_logs"
                                  ? "research logs"
                                  : action === "start_routine_orchestrator"
                                    ? "rutinas on"
                                    : action === "stop_routine_orchestrator"
                                      ? "rutinas off"
                                      : action === "routine_orchestrator_logs"
                                        ? "rutinas logs"
                                        : action === "setup_colega_cron_preview"
                                          ? "cron OpenClaw"
                                  : action}
    </button>
  );
}

function channelStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "activo",
    configured: "configurado",
    planned: "pendiente",
    disabled: "apagado",
    error: "error",
  };
  return labels[status] || status;
}

export function AgentInspector({ agent }: { agent?: AgentSnapshot }) {
  const [task, setTask] = useState("");
  const adminToken = useCommandCenterStore((state) => state.adminToken);
  const setAdminToken = useCommandCenterStore((state) => state.setAdminToken);
  const logs = useCommandCenterStore((state) => (agent ? state.logsByAgent[agent.id] : ""));
  const actionOutput = useCommandCenterStore((state) => state.actionOutput);
  const sendSocioTask = useCommandCenterStore((state) => state.sendSocioTask);

  if (!agent) return null;

  const submitTask = async () => {
    if (!task.trim()) return;
    await sendSocioTask(task.trim());
    setTask("");
  };

  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{agent.alias}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{agent.name}</h2>
          <p className="mt-1 text-sm text-slate-300">{agent.role}</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${statusClasses(agent.status)}`}>
          <span className={`h-2 w-2 rounded-full shadow-lg ${dotClasses(agent.status)}`} />
          {statusLabel(agent.status)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Docker</p>
          <p className="mt-2 text-slate-100">{agent.runtime.dockerStatus}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Modelo</p>
          <p className="mt-2 text-slate-100">{agent.currentModel || "N/A"}</p>
        </div>
      </div>

      {agent.runtimeDetails && agent.runtimeDetails.length > 1 ? (
        <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Runtimes internos</p>
          <div className="mt-3 grid gap-2">
            {agent.runtimeDetails.map((runtime) => (
              <div key={runtime.containerName} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.035] px-2 py-1.5 text-xs">
                <span className="font-mono text-slate-200">{runtime.containerName}</span>
                <span className={runtime.running ? "text-emerald-100" : "text-slate-400"}>{runtime.dockerStatus}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="text-xs uppercase tracking-[0.16em] text-slate-400" htmlFor="admin-token">
          Token del dashboard, no OpenClaw
        </label>
        <input
          id="admin-token"
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="DASHBOARD_ADMIN_TOKEN o AGENT_ADMIN_TOKEN"
          className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/50"
        />
      </div>

      {agent.id === "colega" ? (
        <p className="mt-2 rounded-md border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          OpenClaw usa OPENCLAW_GATEWAY_TOKEN dentro de su propia UI. No lo pegues en este campo.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {agent.actions.map((action) => (
          <ActionButton key={action} agent={agent} action={action} />
        ))}
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Canales</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {agent.channels.map((channel) => (
            <div key={channel.id} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white">{channel.label}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  {channelStatusLabel(channel.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{channel.type}</p>
              {channel.url ? (
                <button
                  type="button"
                  onClick={() => window.open(channel.url, "_blank", "noopener,noreferrer")}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-200/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-medium text-cyan-100"
                >
                  <ExternalLink className="h-3 w-3" />
                  abrir
                </button>
              ) : null}
              {channel.command ? (
                <p className="mt-2 flex items-center gap-2 rounded bg-black/25 px-2 py-1 font-mono text-[11px] text-cyan-100">
                  <Terminal className="h-3 w-3" />
                  {channel.command}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {agent.id === "socio" ? (
        <div className="mt-5 rounded-md border border-cyan-200/20 bg-cyan-300/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-100">
            <ClipboardList className="h-4 w-4" />
            Enviar tarea a Socio
          </p>
          <textarea
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="Ej: revisa estado del stack y deja hallazgos en findings"
            className="mt-3 min-h-20 w-full resize-none rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-200/50"
          />
          <button type="button" onClick={submitTask} className="mt-2 flex items-center gap-2 rounded-md bg-cyan-200 px-3 py-2 text-sm font-semibold text-ink-950">
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {agent.error ? <p className="rounded-md border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-100">{agent.error.message}</p> : null}
        {actionOutput ? <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-black/35 p-3 text-xs text-slate-200">{actionOutput}</pre> : null}
        {logs ? <pre className="max-h-64 overflow-auto rounded-md border border-white/10 bg-black/35 p-3 text-xs text-slate-200">{logs}</pre> : null}
      </div>
    </section>
  );
}

