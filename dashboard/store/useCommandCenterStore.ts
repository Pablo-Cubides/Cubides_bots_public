"use client";

import { create } from "zustand";
import type { AgentAction, AgentEvent, AgentId, AgentSnapshot, ModelDiscoveryResponse, SnapshotResponse } from "@/lib/types";

type CommandCenterState = {
  snapshot?: SnapshotResponse;
  selectedAgentId: AgentId;
  logsByAgent: Partial<Record<AgentId, string>>;
  actionOutput?: string;
  modelDiscovery?: ModelDiscoveryResponse;
  adminToken: string;
  loading: boolean;
  fetchSnapshot: () => Promise<void>;
  connectEvents: () => () => void;
  selectAgent: (id: AgentId) => void;
  setAdminToken: (token: string) => void;
  loadLogs: (id: AgentId) => Promise<void>;
  runAction: (id: AgentId, action: AgentAction) => Promise<void>;
  fetchModelDiscovery: () => Promise<void>;
  probeModelDiscovery: () => Promise<void>;
  sendSocioTask: (task: string) => Promise<void>;
};

function tokenHeaders(token: string): HeadersInit {
  return token ? { "X-Dashboard-Admin-Token": token } : {};
}

function systemEvent(message: string, severity: AgentEvent["severity"] = "info"): AgentEvent {
  return {
    id: `ui-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agentId: "system",
    severity,
    message,
  };
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  selectedAgentId: "socio",
  logsByAgent: {},
  modelDiscovery: undefined,
  adminToken: typeof window === "undefined" ? "" : sessionStorage.getItem("dashboard_admin_token") || "",
  loading: false,
  async fetchSnapshot() {
    const response = await fetch("/api/snapshot", { cache: "no-store" });
    const snapshot = (await response.json()) as SnapshotResponse;
    set({ snapshot });
  },
  connectEvents() {
    const source = new EventSource("/api/events");
    source.addEventListener("snapshot", (event) => {
      set({ snapshot: JSON.parse((event as MessageEvent).data) as SnapshotResponse });
    });
    source.onerror = () => source.close();
    return () => source.close();
  },
  selectAgent(id) {
    set({ selectedAgentId: id });
  },
  setAdminToken(token) {
    sessionStorage.setItem("dashboard_admin_token", token);
    set({ adminToken: token });
  },
  async loadLogs(id) {
    const { adminToken } = get();
    set({ loading: true });
    try {
      const response = await fetch(`/api/agents/${id}/logs`, { headers: tokenHeaders(adminToken) });
      if (!response.ok) throw new Error(`Logs rechazados (${response.status})`);
      const data = (await response.json()) as { logs: string };
      set((state) => ({ logsByAgent: { ...state.logsByAgent, [id]: data.logs } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        actionOutput: message,
        snapshot: state.snapshot
          ? { ...state.snapshot, events: [systemEvent(message, "error"), ...state.snapshot.events] }
          : state.snapshot,
      }));
    } finally {
      set({ loading: false });
    }
  },
  async runAction(id, action) {
    const { adminToken } = get();
    set({ loading: true, actionOutput: undefined });
    try {
      const response = await fetch(`/api/agents/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders(adminToken) },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { ok: boolean; commandLabel: string; output: string; error?: string };
      const output = data.output || data.error || "Sin salida.";
      set((state) => ({
        actionOutput: output,
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              events: [systemEvent(`${data.commandLabel}: ${data.ok ? "completado" : "fallo"}`, data.ok ? "success" : "error"), ...state.snapshot.events],
            }
          : state.snapshot,
      }));
      await get().fetchSnapshot();
    } finally {
      set({ loading: false });
    }
  },
  async fetchModelDiscovery() {
    set({ loading: true });
    try {
      const response = await fetch("/api/models/discovery", { cache: "no-store" });
      if (!response.ok) throw new Error(`Discovery rechazado (${response.status})`);
      const modelDiscovery = (await response.json()) as ModelDiscoveryResponse;
      set({ modelDiscovery });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        actionOutput: message,
        snapshot: state.snapshot ? { ...state.snapshot, events: [systemEvent(message, "error"), ...state.snapshot.events] } : state.snapshot,
      }));
    } finally {
      set({ loading: false });
    }
  },
  async probeModelDiscovery() {
    const { adminToken } = get();
    set({ loading: true });
    try {
      const response = await fetch("/api/models/discovery/probe", {
        method: "POST",
        headers: tokenHeaders(adminToken),
      });
      if (!response.ok) throw new Error(`Probe rechazado (${response.status})`);
      const modelDiscovery = (await response.json()) as ModelDiscoveryResponse;
      set((state) => ({
        modelDiscovery,
        snapshot: state.snapshot
          ? { ...state.snapshot, events: [systemEvent("Probes de modelos completados", "success"), ...state.snapshot.events] }
          : state.snapshot,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        actionOutput: message,
        snapshot: state.snapshot ? { ...state.snapshot, events: [systemEvent(message, "error"), ...state.snapshot.events] } : state.snapshot,
      }));
    } finally {
      set({ loading: false });
    }
  },
  async sendSocioTask(task) {
    const { adminToken } = get();
    set({ loading: true });
    try {
      const response = await fetch("/api/agents/socio/task", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeaders(adminToken) },
        body: JSON.stringify({ task }),
      });
      if (!response.ok) throw new Error(`No se pudo enviar tarea (${response.status})`);
      set((state) => ({
        snapshot: state.snapshot
          ? { ...state.snapshot, events: [systemEvent(`Tarea enviada a Socio: ${task}`, "success"), ...state.snapshot.events] }
          : state.snapshot,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        actionOutput: message,
        snapshot: state.snapshot
          ? { ...state.snapshot, events: [systemEvent(message, "error"), ...state.snapshot.events] }
          : state.snapshot,
      }));
    } finally {
      set({ loading: false });
    }
  },
}));

export function selectedAgent(agents: AgentSnapshot[] | undefined, id: AgentId): AgentSnapshot | undefined {
  return agents?.find((agent) => agent.id === id) || agents?.[0];
}


