"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Coins, Cpu, Trophy } from "lucide-react";
import type { AgentSnapshot, SnapshotResponse } from "@/lib/types";

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-2 text-slate-300">
        {icon}
        <span className="text-xs uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function AnalyticsPanel({ snapshot }: { snapshot?: SnapshotResponse }) {
  const agents = snapshot?.agents || [];
  const totals = agents.reduce(
    (acc, agent) => {
      acc.calls += agent.metrics.modelCalls;
      acc.tokens += agent.metrics.inputTokens + agent.metrics.outputTokens;
      acc.usd += agent.metrics.estimatedUsd;
      return acc;
    },
    { calls: 0, tokens: 0, usd: 0 },
  );
  const leader = [...agents].sort((a, b) => b.metrics.messagesSent - a.metrics.messagesSent)[0];

  return (
    <section className="space-y-4 rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel">
      <div>
        <p className="text-sm font-semibold text-white">Analitica</p>
        <p className="text-xs text-slate-400">Metrica real + simulada hasta activar telemetria por agente.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Cpu className="h-4 w-4" />} label="Llamadas" value={String(totals.calls)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Tokens" value={totals.tokens.toLocaleString("en-US")} />
        <StatCard icon={<Coins className="h-4 w-4" />} label="USD Est." value={`$${totals.usd.toFixed(2)}`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Top agente" value={leader?.name || "--"} />
      </div>

      <div className="h-56 rounded-lg border border-white/10 bg-black/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={snapshot?.modelUsage || []}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="model" tick={{ fill: "#aeb9c5", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#aeb9c5", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} contentStyle={{ background: "#101923", border: "1px solid rgba(255,255,255,0.12)" }} />
            <Bar dataKey="calls" fill="#28d7c7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function RankingPanel({ agents }: { agents: AgentSnapshot[] }) {
  const ranked = [...agents].sort((a, b) => b.metrics.estimatedUsd - a.metrics.estimatedUsd);

  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel">
      <p className="text-sm font-semibold text-white">Ranking de actividad</p>
      <div className="mt-3 space-y-2">
        {ranked.map((agent, index) => (
          <div key={agent.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-white">
                {index + 1}. {agent.name}
              </p>
              <p className="text-xs text-slate-400">{agent.metrics.messagesSent} mensajes</p>
            </div>
            <p className="text-sm text-cyan-100">${agent.metrics.estimatedUsd.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


