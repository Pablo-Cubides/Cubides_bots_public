import type { AgentStatus } from "@/lib/types";

export function statusLabel(status: AgentStatus): string {
  const labels: Record<AgentStatus, string> = {
    healthy: "Operativo",
    starting: "Iniciando",
    idle: "En espera",
    working: "Trabajando",
    warning: "Atencion",
    error: "Error",
    offline: "Apagado",
  };
  return labels[status];
}

export function statusClasses(status: AgentStatus): string {
  const classes: Record<AgentStatus, string> = {
    healthy: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    starting: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
    idle: "border-slate-300/30 bg-white/5 text-slate-100",
    working: "border-violet-300/40 bg-violet-400/10 text-violet-100",
    warning: "border-amber-300/50 bg-amber-400/10 text-amber-100",
    error: "border-rose-300/50 bg-rose-400/10 text-rose-100",
    offline: "border-slate-600 bg-slate-900/70 text-slate-300",
  };
  return classes[status];
}

export function dotClasses(status: AgentStatus): string {
  const classes: Record<AgentStatus, string> = {
    healthy: "bg-emerald-300 shadow-emerald-300/50",
    starting: "bg-cyan-300 shadow-cyan-300/50",
    idle: "bg-slate-300 shadow-slate-300/30",
    working: "bg-violet-300 shadow-violet-300/50",
    warning: "bg-amber-300 shadow-amber-300/50",
    error: "bg-rose-300 shadow-rose-300/50",
    offline: "bg-slate-500 shadow-slate-500/30",
  };
  return classes[status];
}

