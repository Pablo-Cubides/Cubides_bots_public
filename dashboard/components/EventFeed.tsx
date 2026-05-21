"use client";

import type { AgentEvent } from "@/lib/types";

const eventClasses: Record<AgentEvent["severity"], string> = {
  info: "border-slate-400/20 text-slate-200",
  success: "border-emerald-300/30 text-emerald-100",
  warning: "border-amber-300/30 text-amber-100",
  error: "border-rose-300/30 text-rose-100",
};

export function EventFeed({ events }: { events: AgentEvent[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/95 p-4 shadow-panel">
      <p className="text-sm font-semibold text-white">Eventos en vivo</p>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
        {events.slice(0, 12).map((event) => (
          <div key={event.id} className={`rounded-md border bg-white/[0.035] px-3 py-2 ${eventClasses[event.severity]}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.16em]">{event.agentId}</span>
              <span className="text-[11px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="mt-1 text-sm">{event.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

