import path from "node:path";
import { readEnvFile, repoRoot } from "./slack_memory.mjs";

const rootEnv = readEnvFile(path.join(repoRoot, ".env"));

export function runtimeConfig() {
  return {
    runtime: process.env.SOCIO_AGENT_RUNTIME || rootEnv.SOCIO_AGENT_RUNTIME || "gemini-cli",
    container: process.env.SOCIO_DAEMON_CONTAINER || rootEnv.SOCIO_DAEMON_CONTAINER || "business_agent_daemon",
    workdir: process.env.SOCIO_AGENT_WORKDIR || rootEnv.SOCIO_AGENT_WORKDIR || "/app/data/tasks",
    node: process.env.SOCIO_AGENT_NODE || rootEnv.SOCIO_AGENT_NODE || "node",
    geminiScript:
      process.env.SOCIO_GEMINI_CLI_SCRIPT ||
      rootEnv.SOCIO_GEMINI_CLI_SCRIPT ||
      process.env.GEMINI_CLI_SCRIPT ||
      rootEnv.GEMINI_CLI_SCRIPT ||
      "/usr/lib/node_modules/@google/gemini-cli/bundle/gemini.js",
  };
}

export function assertSupportedRuntime(config = runtimeConfig()) {
  if (config.runtime !== "gemini-cli") {
    throw new Error(
      `SOCIO_AGENT_RUNTIME=${config.runtime} aun no esta implementado. Mantener gemini-cli hasta validar Antigravity CLI en paralelo.`,
    );
  }
}

export function socioGeminiDockerArgs({ model, prompt, approvalMode = "yolo", outputFormat = "text" }) {
  const config = runtimeConfig();
  assertSupportedRuntime(config);
  return [
    "exec",
    "-w",
    config.workdir,
    config.container,
    config.node,
    config.geminiScript,
    "--model",
    model,
    "--prompt",
    prompt,
    "--approval-mode",
    approvalMode,
    "--skip-trust",
    "--output-format",
    outputFormat,
  ];
}

