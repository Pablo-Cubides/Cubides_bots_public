"use client";

import { BrainCircuit, Gauge, PlayCircle, RefreshCw } from "lucide-react";
import type { ModelAccessRecord, ModelAccessStatus, ModelPhase } from "@/lib/types";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

const statusStyles: Record<ModelAccessStatus, string> = {
  ok: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  listed: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  candidate: "border-slate-300/20 bg-white/[0.06] text-slate-200",
  limited: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  no_access: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  deprecated: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  experimental: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  failed: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

const phaseLabel: Record<ModelPhase, string> = {
  fast: "Rapido",
  standard: "Normal",
  deep: "Profundo",
  planning: "Plan grande",
  experimental: "Experimental",
  fallback: "Fallback",
};

const agentLabel: Record<ModelAccessRecord["agent"], string> = {
  colega: "Colega",
  coach: "Coach",
  socio: "Socio",
};

function providerTitle(provider: string) {
  if (provider === "openai-codex") return "OpenAI Codex";
  if (provider === "claude-oauth") return "Claude OAuth";
  if (provider === "gemini-cli") return "Gemini CLI";
  return provider;
}

export function ModelDiscoveryPanel() {
  const discovery = useCommandCenterStore((state) => state.modelDiscovery);
  const fetchModelDiscovery = useCommandCenterStore((state) => state.fetchModelDiscovery);
  const probeModelDiscovery = useCommandCenterStore((state) => state.probeModelDiscovery);
  const loading = useCommandCenterStore((state) => state.loading);

  const models = discovery?.models || [];
  const grouped = models.reduce<Record<string, ModelAccessRecord[]>>((acc, model) => {
    const key = `${model.agent}:${model.provider}`;
    acc[key] = [...(acc[key] || []), model];
    return acc;
  }, {});

  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100">
            <BrainCircuit className="h-4 w-4" />
            Modelos disponibles
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Routing recomendado por fases</h2>
          <p className="mt-1 text-sm text-slate-400">Vista filtrada: proveedor, fase, acceso y nota util. Sin salida cruda de consola.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchModelDiscovery()}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-200/40"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Ejecutar probes reales de modelos? Puede consumir cuota minima.")) void probeModelDiscovery();
            }}
            className="flex items-center gap-2 rounded-md border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-100"
          >
            <PlayCircle className="h-4 w-4" />
            Probar acceso
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          {discovery ? new Date(discovery.generatedAt).toLocaleString() : "sin discovery cargado"}
        </span>
        {discovery ? <span>Probes: {discovery.probesRun ? "si" : "no"}</span> : null}
        {loading ? <span className="text-cyan-100">actualizando...</span> : null}
      </div>

      {discovery?.events?.length ? (
        <div className="mt-3 grid gap-2">
          {discovery.events.map((event, index) => (
            <p key={`${event.message}-${index}`} className="rounded-md border border-amber-200/20 bg-amber-300/10 p-2 text-xs text-amber-100">
              {event.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {Object.entries(grouped).map(([key, items]) => {
          const [agent, provider] = key.split(":") as [ModelAccessRecord["agent"], string];
          return (
            <div key={key} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{agentLabel[agent]}</p>
                  <p className="text-xs text-slate-400">{providerTitle(provider)}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300">{items.length} modelos</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className="pb-2 font-medium">Fase</th>
                      <th className="pb-2 font-medium">Modelo</th>
                      <th className="pb-2 font-medium">Estado</th>
                      <th className="pb-2 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((model) => (
                      <tr key={`${model.provider}-${model.model}-${model.phase}`} className="border-b border-white/[0.06] last:border-0">
                        <td className="py-2 text-slate-200">{phaseLabel[model.phase]}</td>
                        <td className="py-2 font-mono text-cyan-100">{model.model}</td>
                        <td className="py-2">
                          <span className={`rounded-full border px-2 py-1 uppercase tracking-[0.12em] ${statusStyles[model.status]}`}>{model.status}</span>
                        </td>
                        <td className="py-2 text-slate-300">{model.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {!models.length ? <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Pulsa Actualizar para cargar la matriz.</p> : null}
      </div>
    </section>
  );
}

