"use client";

import { Activity, Mail, MonitorUp, Trees } from "lucide-react";
import type { AgentId, AgentSnapshot } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";
import { dotClasses } from "./status";

function Tree({ className = "" }: { className?: string }) {
  return (
    <span className={`absolute h-16 w-12 ${className}`}>
      <span className="absolute bottom-0 left-1/2 h-7 w-4 -translate-x-1/2 border-2 border-[#2b1b14] bg-[#7a4b2b]" />
      <span className="absolute left-1 top-1 h-10 w-10 border-4 border-[#1f321c] bg-[#3f7a35] shadow-pixel" />
      <span className="absolute left-3 top-0 h-8 w-8 border-4 border-[#1f321c] bg-[#5a9d43]" />
    </span>
  );
}

function Lamp({ className = "" }: { className?: string }) {
  return (
    <span className={`absolute h-12 w-7 ${className}`}>
      <span className="absolute bottom-0 left-1/2 h-9 w-2 -translate-x-1/2 bg-[#312a22]" />
      <span className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 border-2 border-[#3c2b1b] bg-[#ffd47a] shadow-[0_0_18px_rgba(255,212,122,0.45)]" />
    </span>
  );
}

function Crate({ className = "" }: { className?: string }) {
  return <span className={`absolute h-8 w-10 border-4 border-[#5d3925] bg-[#a66f3f] shadow-pixel ${className}`} />;
}

function Sign({ className = "", label }: { className?: string; label: string }) {
  return (
    <span className={`absolute ${className}`}>
      <span className="block border-2 border-[#3a271d] bg-[#d7b16d] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#372317] shadow-pixel">{label}</span>
      <span className="mx-auto block h-5 w-2 bg-[#4b3525]" />
    </span>
  );
}

function Building({
  className,
  roof,
  body,
  trim,
  label,
  children,
}: {
  className: string;
  roof: string;
  body: string;
  trim: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`town-building absolute border-4 shadow-pixel ${className}`} style={{ borderColor: trim, backgroundColor: body }}>
      <div className="absolute -left-3 -right-3 -top-8 h-10 border-4 shadow-pixel" style={{ borderColor: trim, backgroundColor: roof }} />
      <div className="absolute -left-1 -right-1 top-1 h-4 opacity-35" style={{ backgroundColor: "#fff4c2" }} />
      {children}
      <span className="absolute -bottom-8 left-0 border-2 border-[#1d1713] bg-[#111a16]/90 px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100 shadow-pixel">{label}</span>
    </div>
  );
}

export function MiniVerseMap({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: AgentSnapshot[];
  selectedAgentId: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  const healthyCount = agents.filter((agent) => agent.status === "healthy").length;
  const warningCount = agents.filter((agent) => agent.status === "warning" || agent.status === "error" || agent.status === "offline").length;

  return (
    <section className="relative min-h-[720px] overflow-hidden rounded-lg border border-amber-100/15 bg-[#182013] shadow-panel">
      <div className="town-grass absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,238,180,0.08),transparent_32%,rgba(5,8,12,0.22))]" />

      <div className="absolute -right-12 bottom-0 h-44 w-80 border-4 border-[#1f4251] bg-[#27566a] shadow-pixel">
        <div className="water-shine absolute inset-0" />
      </div>
      <div className="absolute bottom-[136px] right-[236px] h-12 w-32 border-4 border-[#5f3f2f] bg-[#9f7448] shadow-pixel" />

      <div className="town-path absolute left-[7%] top-[47%] h-[74px] w-[86%]" />
      <div className="town-path absolute left-[45%] top-[10%] h-[79%] w-[76px]" />
      <div className="town-plaza absolute left-1/2 top-[49%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 border-4 border-[#7d5c36] bg-[#bd9564] shadow-pixel">
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 border-4 border-[#7d5c36] bg-[#d8b174]" />
        <Activity className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[#4d3924]" />
      </div>

      <Building className="left-[7%] top-[14%] h-44 w-64" roof="#723d3b" body="#8f6547" trim="#4e3427" label="Biblioteca" >
        <div className="absolute left-6 top-8 grid grid-cols-3 gap-3">
          <span className="h-9 w-11 border-4 border-[#4e3427] bg-[#f2dca2]" />
          <span className="h-9 w-11 border-4 border-[#4e3427] bg-[#f2dca2]" />
          <span className="h-9 w-11 border-4 border-[#4e3427] bg-[#f2dca2]" />
        </div>
        <div className="absolute bottom-0 left-1/2 h-16 w-14 -translate-x-1/2 border-x-4 border-t-4 border-[#2a1f1a] bg-[#3f2a24]" />
        <div className="absolute bottom-6 left-7 h-7 w-20 border-4 border-[#5b3a28] bg-[#d6b36d]" />
      </Building>

      <Building className="bottom-[13%] left-[10%] h-42 w-72" roof="#263349" body="#516584" trim="#28364f" label="Taller técnico">
        <div className="absolute left-6 top-8 flex gap-3">
          <span className="h-12 w-16 border-4 border-[#203048] bg-[#9fe2ff] shadow-[0_0_16px_rgba(159,226,255,0.35)]" />
          <span className="h-12 w-16 border-4 border-[#203048] bg-[#65d4ff] shadow-[0_0_16px_rgba(101,212,255,0.35)]" />
          <span className="h-12 w-16 border-4 border-[#203048] bg-[#b8efff] shadow-[0_0_16px_rgba(184,239,255,0.35)]" />
        </div>
        <div className="absolute bottom-0 right-10 h-14 w-14 border-x-4 border-t-4 border-[#171f2b] bg-[#202632]" />
        <div className="absolute bottom-8 left-8 h-3 w-36 bg-[#2de2c7]" />
      </Building>

      <Building className="right-[8%] top-[16%] h-52 w-72" roof="#45502e" body="#77834a" trim="#343d25" label="Oficina Socio">
        <div className="absolute bottom-0 left-8 h-16 w-14 border-x-4 border-t-4 border-[#202818] bg-[#2f3324]" />
        <div className="absolute bottom-0 right-8 h-16 w-14 border-4 border-[#2f3324] bg-[#b5975f]" />
        <div className="absolute left-7 top-9 grid grid-cols-2 gap-4">
          <span className="h-11 w-20 border-4 border-[#3f4b2b] bg-[#e8d39b]" />
          <span className="h-11 w-20 border-4 border-[#3f4b2b] bg-[#f0e1ad]" />
        </div>
        <div className="absolute bottom-7 left-28 h-8 w-16 border-4 border-[#394126] bg-[#caa766]" />
      </Building>

      <div className="absolute bottom-[10%] right-[9%] h-32 w-56 border-4 border-[#514137] bg-[#2f3b3f] shadow-pixel">
        <div className="h-8 border-b-4 border-[#514137] bg-[#1f282d]" />
        <div className="mx-5 mt-4 h-9 border-4 border-[#133a3a] bg-[#31d7c7] shadow-[0_0_18px_rgba(49,215,199,0.36)]" />
        <div className="mx-5 mt-2 grid grid-cols-4 gap-1">
          <span className="h-2 bg-[#ffd47a]" />
          <span className="h-2 bg-[#7cffad]" />
          <span className="h-2 bg-[#ff7a95]" />
          <span className="h-2 bg-[#9fe2ff]" />
        </div>
        <span className="absolute -bottom-8 left-0 border-2 border-[#1d1713] bg-[#111a16]/90 px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 shadow-pixel">Terminal room</span>
      </div>

      <Tree className="left-[4%] top-[46%]" />
      <Tree className="left-[35%] top-[13%]" />
      <Tree className="right-[31%] top-[9%]" />
      <Tree className="right-[5%] top-[53%]" />
      <Tree className="left-[52%] bottom-[7%]" />
      <Lamp className="left-[38%] top-[42%]" />
      <Lamp className="left-[58%] top-[42%]" />
      <Lamp className="left-[47%] top-[28%]" />
      <Lamp className="left-[47%] bottom-[20%]" />
      <Crate className="left-[29%] top-[42%]" />
      <Crate className="right-[28%] bottom-[25%]" />
      <Sign className="left-[59%] top-[55%]" label="mail" />
      <span className="absolute left-[62%] top-[43%] flex h-12 w-12 items-center justify-center border-4 border-[#3a271d] bg-[#b64b4b] text-[#ffe6bd] shadow-pixel">
        <Mail className="h-6 w-6" />
      </span>

      <div className="absolute left-8 top-8 border-4 border-[#2c3a31] bg-[#0d1613]/90 px-4 py-3 shadow-pixel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Agents Town</p>
        <p className="mt-1 text-xs text-slate-300">Centro vivo de control local</p>
      </div>

      <div className="absolute right-8 top-8 w-56 border-4 border-[#2c3a31] bg-[#0d1613]/90 p-3 shadow-pixel">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime-100">
          <Trees className="h-4 w-4" />
          Estado del pueblo
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="border-2 border-[#26372d] bg-[#17251f] p-2">
            <p className="text-slate-400">Healthy</p>
            <p className="mt-1 text-lg font-semibold text-emerald-100">{healthyCount}</p>
          </div>
          <div className="border-2 border-[#3d3023] bg-[#281d17] p-2">
            <p className="text-slate-400">Alertas</p>
            <p className="mt-1 text-lg font-semibold text-amber-100">{warningCount}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-cyan-100">
          <MonitorUp className="h-4 w-4" />
          Socio Heavy vive dentro de Socio
        </div>
      </div>

      {agents.map((agent) => (
        <AgentAvatar key={agent.id} agent={agent} selected={selectedAgentId === agent.id} onSelect={() => onSelect(agent.id)} />
      ))}

      <div className="absolute bottom-4 left-5 right-5 h-7 border-2 border-[#2c3a31] bg-[#0d1613]/80 px-3 py-1 text-[11px] text-slate-300 shadow-pixel">
        {agents.map((agent) => (
          <span key={agent.id} className="mr-4 inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${dotClasses(agent.status)}`} />
            {agent.name}: {agent.status}
          </span>
        ))}
      </div>
    </section>
  );
}


