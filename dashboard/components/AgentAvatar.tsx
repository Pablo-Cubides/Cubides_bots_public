"use client";

import { motion } from "motion/react";
import { AlertTriangle, BookOpen, BriefcaseBusiness, Coffee, TerminalSquare } from "lucide-react";
import type { AgentSnapshot } from "@/lib/types";
import { dotClasses, statusLabel } from "./status";

const positions: Record<string, string> = {
  colega: "left-[25%] top-[36%]",
  coach: "left-[34%] top-[72%]",
  socio: "left-[70%] top-[41%]",
};

const palette: Record<string, { hair: string; shirt: string; vest: string; pants: string; accent: string; skin: string }> = {
  colega: { hair: "#5b3b26", shirt: "#e7c76b", vest: "#9b6f41", pants: "#2d2b3f", accent: "#fff0b6", skin: "#d7a37a" },
  coach: { hair: "#283047", shirt: "#45a7d8", vest: "#263349", pants: "#20283b", accent: "#a7f3ff", skin: "#c98f6b" },
  socio: { hair: "#31351f", shirt: "#7d8b40", vest: "#3f4d28", pants: "#26301f", accent: "#d7f27f", skin: "#d8a06f" },
};

function AgentIcon({ id }: { id: string }) {
  if (id === "colega") return <BookOpen className="h-5 w-5" />;
  if (id === "coach") return <TerminalSquare className="h-5 w-5" />;
  return <BriefcaseBusiness className="h-5 w-5" />;
}

function Accessory({ id }: { id: string }) {
  if (id === "colega") {
    return <span className="absolute -right-1 top-14 h-7 w-5 border-2 border-[#211a18] bg-[#f4df9b]" />;
  }
  if (id === "coach") {
    return <span className="absolute -right-3 top-13 flex h-8 w-8 items-center justify-center border-2 border-[#211a18] bg-[#111827] text-[#9fe2ff]"><TerminalSquare className="h-4 w-4" /></span>;
  }
  return <span className="absolute -right-2 top-13 flex h-7 w-7 items-center justify-center border-2 border-[#211a18] bg-[#8b5f34] text-[#ffe0a3]"><Coffee className="h-4 w-4" /></span>;
}

export function AgentAvatar({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const danger = agent.status === "error" || agent.status === "offline";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`absolute ${positions[agent.id]} group w-36 -translate-x-1/2 -translate-y-1/2 text-left`}
      animate={agent.avatarState === "working" || agent.avatarState === "typing" ? { y: [0, -5, 0] } : { y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: agent.avatarState === "working" ? 1 : 2.6, ease: "easeInOut" }}
    >
      <span className="absolute left-1/2 top-[82px] h-4 w-24 -translate-x-1/2 bg-black/30 blur-sm" />
      <span className={`relative mx-auto block h-28 w-24 pixelated ${selected ? "drop-shadow-[0_0_14px_rgba(103,232,249,0.9)]" : ""}`}>
        <span className="absolute left-1/2 top-1 h-8 w-11 -translate-x-1/2 border-4 border-[#211a18]" style={{ backgroundColor: palette[agent.id].skin }} />
        <span className="absolute left-1/2 top-0 h-4 w-14 -translate-x-1/2 border-x-4 border-t-4 border-[#211a18]" style={{ backgroundColor: palette[agent.id].hair }} />
        <span className="absolute left-[32px] top-4 h-2 w-2 bg-[#211a18]" />
        <span className="absolute right-[32px] top-4 h-2 w-2 bg-[#211a18]" />
        <span className="absolute left-1/2 top-8 h-12 w-11 -translate-x-1/2 border-4 border-[#211a18]" style={{ backgroundColor: danger ? "#b8324a" : palette[agent.id].shirt }} />
        <span className="absolute left-[35px] top-10 h-9 w-5 border-2 border-[#211a18]" style={{ backgroundColor: danger ? "#7f1d2d" : palette[agent.id].vest }} />
        <span className="absolute right-[35px] top-10 h-9 w-5 border-2 border-[#211a18]" style={{ backgroundColor: danger ? "#7f1d2d" : palette[agent.id].vest }} />
        <span className="absolute left-[15px] top-11 h-8 w-5 border-4 border-[#211a18]" style={{ backgroundColor: danger ? "#b8324a" : palette[agent.id].shirt }} />
        <span className="absolute right-[15px] top-11 h-8 w-5 border-4 border-[#211a18]" style={{ backgroundColor: danger ? "#b8324a" : palette[agent.id].shirt }} />
        <span className="absolute left-[30px] top-[74px] h-8 w-5 border-4 border-[#211a18]" style={{ backgroundColor: palette[agent.id].pants }} />
        <span className="absolute right-[30px] top-[74px] h-8 w-5 border-4 border-[#211a18]" style={{ backgroundColor: palette[agent.id].pants }} />
        <span className="absolute left-1/2 top-12 flex h-7 w-7 -translate-x-1/2 items-center justify-center border-2 border-[#211a18] bg-[#101713]/80 text-white">
          {danger ? <AlertTriangle className="h-4 w-4 text-rose-100" /> : <AgentIcon id={agent.id} />}
        </span>
        <span className="absolute left-1/2 top-[70px] h-2 w-9 -translate-x-1/2" style={{ backgroundColor: palette[agent.id].accent }} />
        <Accessory id={agent.id} />
        {agent.avatarState === "typing" || agent.avatarState === "working" ? <span className="absolute -top-5 right-1 border-2 border-[#211a18] bg-[#fff0b6] px-1 text-[10px] font-bold text-[#211a18]">...</span> : null}
      </span>
      <span className={`mt-3 block border-2 px-2 py-1 text-center shadow-pixel ${selected ? "border-cyan-100 bg-[#10262a]" : "border-[#211a18] bg-[#101713]/90"}`}>
        <span className="block truncate text-xs font-semibold text-white">{agent.name}</span>
        <span className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
          <span className={`h-1.5 w-1.5 rounded-full shadow-lg ${dotClasses(agent.status)}`} />
          {statusLabel(agent.status)}
        </span>
      </span>
    </motion.button>
  );
}


