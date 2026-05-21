import { runPowerShell } from "./shell";
import type { ModelDiscoveryResponse } from "./types";

const fallbackDiscovery: ModelDiscoveryResponse = {
  generatedAt: new Date(0).toISOString(),
  probesRun: false,
  dockerAvailable: false,
  events: [{ severity: "warning", message: "Discovery no disponible; usando matriz recomendada." }],
  models: [
    { agent: "colega", provider: "openai-codex", model: "openai-codex/gpt-5.4-mini", phase: "fast", status: "listed", notes: "Rapido para Colega." },
    { agent: "colega", provider: "openai-codex", model: "openai-codex/gpt-5.4", phase: "standard", status: "listed", notes: "Principal fuerte para Colega." },
    { agent: "colega", provider: "openai-codex", model: "openai-codex/gpt-5.3-codex", phase: "deep", status: "listed", notes: "Comparativo profundo." },
    { agent: "coach", provider: "claude-oauth", model: "haiku", phase: "fast", status: "candidate", notes: "Rapido/simple." },
    { agent: "coach", provider: "claude-oauth", model: "sonnet", phase: "standard", status: "candidate", notes: "Trabajo normal serio." },
    { agent: "coach", provider: "claude-oauth", model: "opus", phase: "deep", status: "candidate", notes: "Razonamiento dificil." },
    { agent: "coach", provider: "claude-oauth", model: "opusplan", phase: "planning", status: "candidate", notes: "Planificacion grande." },
    { agent: "socio", provider: "gemini-cli", model: "flash-lite", phase: "fast", status: "candidate", notes: "Rapido/economico." },
    { agent: "socio", provider: "gemini-cli", model: "flash", phase: "standard", status: "candidate", notes: "Ruta normal." },
    { agent: "socio", provider: "gemini-cli", model: "pro", phase: "deep", status: "candidate", notes: "Razonamiento avanzado." },
  ],
};

export async function discoverModels(runProbes: boolean): Promise<ModelDiscoveryResponse> {
  const flag = runProbes ? " -RunProbes" : "";
  try {
    const output = await runPowerShell(`.\\scripts\\discover-model-access.ps1 -Json${flag}`, runProbes ? 900000 : 180000);
    const parsed = JSON.parse(output) as ModelDiscoveryResponse;
    return { ...parsed, models: parsed.models || [], events: parsed.events || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...fallbackDiscovery,
      generatedAt: new Date().toISOString(),
      events: [{ severity: "error", message }],
    };
  }
}

