import fs from "node:fs";
import path from "node:path";

export const repoRoot = path.resolve(process.cwd(), "..");

export function readRootEnv(): Record<string, string> {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return {};

  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

export function dashboardToken(): string {
  const rootEnv = readRootEnv();
  return process.env.DASHBOARD_ADMIN_TOKEN || rootEnv.DASHBOARD_ADMIN_TOKEN || rootEnv.AGENT_ADMIN_TOKEN || "";
}

export function agentAdminToken(): string {
  const rootEnv = readRootEnv();
  return rootEnv.AGENT_ADMIN_TOKEN || "";
}

export function envPresence(names: string[]): Record<string, boolean> {
  const rootEnv = readRootEnv();
  return Object.fromEntries(names.map((name) => [name, Boolean(rootEnv[name])]));
}

export function runtimeEnvPresence(fileName: string, names: string[]): Record<string, boolean> {
  const runtimePath = path.join(repoRoot, "secrets", "runtime", fileName);
  if (!fs.existsSync(runtimePath)) return Object.fromEntries(names.map((name) => [name, false]));
  const text = fs.readFileSync(runtimePath, "utf8");
  const keys = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    keys.add(trimmed.slice(0, index).replace(/^\uFEFF/, ""));
  }
  return Object.fromEntries(names.map((name) => [name, keys.has(name)]));
}

export function encryptedSecretPresence(fileName: string, names: string[]): Record<string, boolean> {
  const secretPath = path.join(repoRoot, "secrets", fileName);
  if (!fs.existsSync(secretPath)) return Object.fromEntries(names.map((name) => [name, false]));
  const text = fs.readFileSync(secretPath, "utf8");
  return Object.fromEntries(
    names.map((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [name, new RegExp(`^\\s*${escaped}:`, "m").test(text)];
    }),
  );
}


