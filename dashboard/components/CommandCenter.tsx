"use client";

import { useEffect } from "react";
import { BrainCircuit, CalendarClock, ExternalLink, Gauge, MessageSquare, Play, RefreshCw, ShieldCheck, Square } from "lucide-react";
import { MiniVerseMap } from "./MiniVerseMap";
import { AgentInspector } from "./AgentInspector";
import { AnalyticsPanel, RankingPanel } from "./AnalyticsPanel";
import { EventFeed } from "./EventFeed";
import { ModelDiscoveryPanel } from "./ModelDiscoveryPanel";
import { selectedAgent, useCommandCenterStore } from "@/store/useCommandCenterStore";
import type { AgentId } from "@/lib/types";

export function CommandCenter() {
  const snapshot = useCommandCenterStore((state) => state.snapshot);
  const selectedAgentId = useCommandCenterStore((state) => state.selectedAgentId);
  const selectAgent = useCommandCenterStore((state) => state.selectAgent);
  const fetchSnapshot = useCommandCenterStore((state) => state.fetchSnapshot);
  const fetchModelDiscovery = useCommandCenterStore((state) => state.fetchModelDiscovery);
  const connectEvents = useCommandCenterStore((state) => state.connectEvents);
  const runAction = useCommandCenterStore((state) => state.runAction);
  const loading = useCommandCenterStore((state) => state.loading);

  useEffect(() => {
    void fetchSnapshot();
    void fetchModelDiscovery();
    const disconnect = connectEvents();
    return disconnect;
  }, [connectEvents, fetchModelDiscovery, fetchSnapshot]);

  const agents = snapshot?.agents || [];
  const agent = selectedAgent(agents, selectedAgentId);
  const slackBridge = snapshot?.integrations.slackBridge;
  const deepResearchRunner = snapshot?.integrations.deepResearchRunner;
  const routineOrchestrator = snapshot?.integrations.routineOrchestrator;
  const colegaOpenClawCron = snapshot?.integrations.colegaOpenClawCron;

  const openInterfaces = () => {
    for (const item of agents.filter((candidate) => candidate.localUrl && candidate.runtime.running)) {
      window.open(item.localUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="min-h-screen bg-ink-950 px-4 py-5 text-slate-100 md:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-100">Cubides Bots</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Centro de Comando Multi-Agente</h1>
            <p className="mt-1 text-sm text-slate-400">Control local, estado operativo, canales y diagnostico rapido.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchSnapshot()}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium transition hover:border-cyan-200/40"
            >
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </button>
            <button
              type="button"
              onClick={() => void Promise.all((["colega", "coach", "socio"] as AgentId[]).map((id) => runAction(id, "start")))}
              className="flex items-center gap-2 rounded-md border border-emerald-200/30 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100"
            >
              <Play className="h-4 w-4" />
              Levantar todos
            </button>
            <button
              type="button"
              onClick={() => void Promise.all((["coach", "socio"] as AgentId[]).map((id) => runAction(id, "validate")))}
              className="flex items-center gap-2 rounded-md border border-violet-200/30 bg-violet-300/10 px-3 py-2 text-sm font-medium text-violet-100"
            >
              <ShieldCheck className="h-4 w-4" />
              Validar stack
            </button>
            <button
              type="button"
              onClick={() => void runAction("coach", "audit_models")}
              className="flex items-center gap-2 rounded-md border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm font-medium text-amber-100"
            >
              <BrainCircuit className="h-4 w-4" />
              Auditar modelos pro
            </button>
            <button
              type="button"
              onClick={() => void fetchModelDiscovery()}
              className="flex items-center gap-2 rounded-md border border-sky-200/30 bg-sky-300/10 px-3 py-2 text-sm font-medium text-sky-100"
            >
              <BrainCircuit className="h-4 w-4" />
              Modelos disponibles
            </button>
            <button
              type="button"
              onClick={() => void runAction("socio", slackBridge?.running ? "stop_slack_bridge" : "start_slack_bridge")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                slackBridge?.running
                  ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"
                  : "border-slate-300/20 bg-white/[0.06] text-slate-100"
              }`}
              title={slackBridge?.status || "Estado Slack Bridge"}
            >
              {slackBridge?.running ? <Square className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              Slack Bridge: {slackBridge?.running ? "activo" : "activar"}
            </button>
            <button
              type="button"
              onClick={() => void runAction("socio", deepResearchRunner?.running ? "stop_deep_research_runner" : "start_deep_research_runner")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                deepResearchRunner?.running
                  ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"
                  : "border-slate-300/20 bg-white/[0.06] text-slate-100"
              }`}
              title={deepResearchRunner?.status || "Estado Deep Research Runner"}
            >
              {deepResearchRunner?.running ? <Square className="h-4 w-4" /> : <BrainCircuit className="h-4 w-4" />}
              Research: {deepResearchRunner?.running ? "activo" : "activar"}
            </button>
            <button
              type="button"
              onClick={() => void runAction("socio", routineOrchestrator?.running ? "stop_routine_orchestrator" : "start_routine_orchestrator")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                routineOrchestrator?.running
                  ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"
                  : "border-slate-300/20 bg-white/[0.06] text-slate-100"
              }`}
              title={routineOrchestrator?.status || "Estado Routine Orchestrator"}
            >
              {routineOrchestrator?.running ? <Square className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              Rutinas: {routineOrchestrator?.running ? "activo" : "activar"}
            </button>
            <button
              type="button"
              onClick={openInterfaces}
              className="flex items-center gap-2 rounded-md border border-cyan-200/30 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir interfaces
            </button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(640px,1.35fr)_minmax(420px,0.9fr)]">
          <div className="space-y-5">
            <MiniVerseMap agents={agents} selectedAgentId={selectedAgentId} onSelect={selectAgent} />
            <EventFeed events={snapshot?.events || []} />
            <section className="rounded-lg border border-white/10 bg-ink-900/90 p-4 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100">Rutinas</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Memoria conversacional</h2>
                </div>
                <span className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-200">
                  OpenClaw cron Colega: {colegaOpenClawCron?.status || "sin estado"}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {(snapshot?.routines || []).slice(-6).map((routine) => (
                  <div key={`${routine.agentId}-${routine.routineId}`} className="rounded-md border border-white/10 bg-black/20 p-3 text-xs">
                    <p className="font-medium text-slate-100">{routine.agentId} · {routine.routineId}</p>
                    <p className="mt-1 text-slate-400">{routine.status}{routine.lastRunLocal ? ` · ${routine.lastRunLocal}` : ""}</p>
                    {routine.error ? <p className="mt-1 text-rose-200">{routine.error.slice(0, 120)}</p> : null}
                  </div>
                ))}
                {snapshot?.routines?.length ? null : <p className="text-sm text-slate-400">Aun no hay ejecuciones registradas.</p>}
              </div>
            </section>
          </div>
          <div className="space-y-5">
            <AgentInspector agent={agent} />
            <ModelDiscoveryPanel />
            <AnalyticsPanel snapshot={snapshot} />
            <RankingPanel agents={agents} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-ink-900/80 p-4 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Ultimo snapshot: {snapshot ? new Date(snapshot.generatedAt).toLocaleString() : "cargando..."}
          </span>
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Slack Bridge: {slackBridge?.status || "cargando..."}
          </span>
          <span className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" />
            Research: {deepResearchRunner?.status || "cargando..."}
          </span>
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Rutinas: {routineOrchestrator?.status || "cargando..."}
          </span>
          <span>{loading ? "Ejecutando accion..." : "Listo"}</span>
        </footer>
      </div>
    </main>
  );
}

