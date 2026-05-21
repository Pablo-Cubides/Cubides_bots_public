#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ACTIONS = new Set([
  "verify",
  "list-projects",
  "inspect-project",
  "list-deployments",
  "deployment-events",
  "project-domains",
  "review-errors",
]);

const PROJECT_ALIASES = {
  project-alpha: "project-alpha",
  "project-alpha-club": "project-alpha",
  project-alpha: "project-alpha",
  Project Beta: "Project Beta",
  "Project Beta-mu": "Project Beta",
  Project Gamma: "Project Gamma-ia",
  "Project Gamma-ia": "Project Gamma-ia",
};

function usage() {
  console.error([
    "Uso:",
    "  node vercel_observer.mjs --action verify",
    "  node vercel_observer.mjs --action list-projects [--limit 20]",
    "  node vercel_observer.mjs --action inspect-project --project <name|id|alias>",
    "  node vercel_observer.mjs --action list-deployments [--project <name|id|alias>] [--limit 10]",
    "  node vercel_observer.mjs --action deployment-events --deployment <id|url> [--limit 100]",
    "  node vercel_observer.mjs --action project-domains --project <name|id|alias>",
    "  node vercel_observer.mjs --action review-errors [--project <name|id|alias>] [--limit 5]",
    "",
    "Solo lectura. No despliega, no borra, no cambia dominios ni variables.",
  ].join("\n"));
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) usage();
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    env[trimmed.slice(0, index).replace(/^\uFEFF/, "")] = trimmed.slice(index + 1);
  }
  return env;
}

function loadConfig() {
  const runtimeEnv = parseEnvFile(path.join(repoRoot, "secrets", "runtime", "business.env"));
  const config = { ...runtimeEnv, ...process.env };
  if (!config.VERCEL_TOKEN || config.VERCEL_TOKEN === "PEGA_AQUI_EL_TOKEN") {
    throw new Error("Falta VERCEL_TOKEN real en secrets/runtime/business.env o entorno.");
  }
  return config;
}

function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|secret|password|key/i.test(key)) {
        out[key] = item ? "[redacted]" : item;
      } else {
        out[key] = sanitize(item);
      }
    }
    return out;
  }
  return value;
}

function aliasProject(project) {
  const raw = String(project || "").trim();
  if (!raw) return "";
  return PROJECT_ALIASES[raw.toLowerCase()] || raw;
}

function withQuery(url, params) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}

async function vercelFetch(config, endpoint, params = {}) {
  const query = { ...params };
  if (config.VERCEL_TEAM_ID && !query.teamId) query.teamId = config.VERCEL_TEAM_ID;
  const url = withQuery(`https://api.vercel.com${endpoint}`, query);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = body?.error?.message || body?.message || response.statusText;
    throw new Error(`Vercel API ${response.status}: ${message}`);
  }
  return body;
}

async function resolveProject(config, project) {
  const normalized = aliasProject(project);
  if (!normalized) return "";
  if (normalized.startsWith("prj_")) return normalized;
  const data = await vercelFetch(config, `/v9/projects/${encodeURIComponent(normalized)}`);
  return data.id || normalized;
}

function simplifyProject(project) {
  const production = project.targets?.production;
  const preview = project.targets?.preview;
  return {
    id: project.id,
    name: project.name,
    framework: project.framework,
    nodeVersion: project.nodeVersion,
    latestDeployments: project.latestDeployments?.slice?.(0, 3)?.map(simplifyDeployment) || [],
    production: production ? simplifyDeployment(production) : undefined,
    preview: preview ? simplifyDeployment(preview) : undefined,
    aliases: production?.alias || [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function simplifyDeployment(deployment) {
  const commitMessage = deployment.meta?.githubCommitMessage
    ? String(deployment.meta.githubCommitMessage).split(/\r?\n/)[0].slice(0, 180)
    : undefined;
  return {
    uid: deployment.uid || deployment.id,
    name: deployment.name,
    url: deployment.url ? `https://${deployment.url.replace(/^https?:\/\//, "")}` : undefined,
    state: deployment.state,
    target: deployment.target,
    type: deployment.type,
    meta: deployment.meta ? {
      githubCommitRef: deployment.meta.githubCommitRef,
      githubCommitSha: deployment.meta.githubCommitSha?.slice?.(0, 12) || deployment.meta.githubCommitSha,
      githubCommitMessage: commitMessage,
    } : undefined,
    createdAt: deployment.createdAt,
    buildingAt: deployment.buildingAt,
    readyAt: deployment.readyAt,
    ready: deployment.ready,
    readyState: deployment.readyState,
    readySubstate: deployment.readySubstate,
  };
}

function summarizeEvent(event) {
  const text = event.payload?.text || event.text || event.message || event.payload?.message || "";
  const level = event.type || event.level || event.payload?.level || event.payload?.type || "";
  return {
    type: level,
    createdAt: event.createdAt || event.date || event.payload?.date,
    text: String(text || "").slice(0, 500),
  };
}

function isProblemDeployment(deployment) {
  const state = String(deployment.state || deployment.readyState || "").toUpperCase();
  const substate = String(deployment.readySubstate || "").toUpperCase();
  return !["READY", "BUILDING", "QUEUED", "INITIALIZING"].includes(state) || ["ERROR", "FAILED", "CANCELED"].includes(substate);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = args.action || "verify";
  if (!ACTIONS.has(action)) usage();
  const config = loadConfig();
  const limit = Math.min(Number(args.limit || 20), 100);

  if (action === "verify") {
    const user = await vercelFetch(config, "/v2/user");
    console.log(JSON.stringify(sanitize({
      ok: true,
      user: {
        id: user.user?.id,
        username: user.user?.username,
        email: user.user?.email,
        name: user.user?.name,
      },
      teamIdConfigured: Boolean(config.VERCEL_TEAM_ID),
      mode: "observer-intentional",
      allowedActions: ["verify", "list-projects", "inspect-project", "list-deployments", "deployment-events", "project-domains", "review-errors"],
      interpretation: "Observer mode is the desired active state for Socio right now. It is enough to inspect projects, domains, deployments, deployment events and deployment errors. Do not ask for another VERCEL_TOKEN when this verify call succeeds.",
      nonMutatingPolicy: "This tool intentionally cannot deploy, delete, rollback or edit environment variables.",
    }), null, 2));
    return;
  }

  if (action === "list-projects") {
    const data = await vercelFetch(config, "/v9/projects", { limit });
    console.log(JSON.stringify({
      ok: true,
      projects: (data.projects || []).map(simplifyProject),
      pagination: data.pagination,
    }, null, 2));
    return;
  }

  if (action === "inspect-project") {
    const project = aliasProject(args.project);
    if (!project) usage();
    const data = await vercelFetch(config, `/v9/projects/${encodeURIComponent(project)}`);
    console.log(JSON.stringify({ ok: true, project: simplifyProject(data) }, null, 2));
    return;
  }

  if (action === "list-deployments") {
    const projectId = args.project ? await resolveProject(config, args.project) : "";
    const data = await vercelFetch(config, "/v6/deployments", {
      limit,
      ...(projectId ? { projectId } : {}),
    });
    console.log(JSON.stringify({
      ok: true,
      deployments: (data.deployments || []).map(simplifyDeployment),
      pagination: data.pagination,
    }, null, 2));
    return;
  }

  if (action === "deployment-events") {
    const deployment = String(args.deployment || "").trim();
    if (!deployment) usage();
    const idOrUrl = deployment.replace(/^https?:\/\//, "");
    const data = await vercelFetch(config, `/v2/deployments/${encodeURIComponent(idOrUrl)}/events`, { limit });
    console.log(JSON.stringify({
      ok: true,
      deployment: idOrUrl,
      events: sanitize(data.events || data),
    }, null, 2));
    return;
  }

  if (action === "project-domains") {
    const project = aliasProject(args.project);
    if (!project) usage();
    const data = await vercelFetch(config, `/v9/projects/${encodeURIComponent(project)}/domains`);
    console.log(JSON.stringify({
      ok: true,
      project,
      domains: sanitize(data.domains || []),
      pagination: data.pagination,
    }, null, 2));
    return;
  }

  if (action === "review-errors") {
    const projectId = args.project ? await resolveProject(config, args.project) : "";
    const deploymentsData = await vercelFetch(config, "/v6/deployments", {
      limit,
      ...(projectId ? { projectId } : {}),
    });
    const deployments = (deploymentsData.deployments || []).map(simplifyDeployment);
    const candidates = deployments.filter(isProblemDeployment);
    const reviewed = [];
    for (const deployment of candidates.slice(0, Math.min(candidates.length, 5))) {
      try {
        const idOrUrl = (deployment.uid || deployment.url || "").replace(/^https?:\/\//, "");
        if (!idOrUrl) continue;
        const eventsData = await vercelFetch(config, `/v2/deployments/${encodeURIComponent(idOrUrl)}/events`, { limit: 50 });
        const events = (eventsData.events || eventsData || [])
          .map(summarizeEvent)
          .filter((event) => event.text || event.type)
          .slice(-20);
        reviewed.push({ deployment, events });
      } catch (error) {
        reviewed.push({
          deployment,
          eventsError: error instanceof Error ? error.message : String(error),
        });
      }
    }
    console.log(JSON.stringify(sanitize({
      ok: true,
      mode: "observer-intentional",
      project: args.project ? aliasProject(args.project) : "all",
      deploymentsReviewed: deployments.length,
      problemDeployments: candidates.length,
      latestDeployments: deployments.slice(0, 5),
      reviewed,
      note: "Modo observador intencional: revisa despliegues, eventos y errores sin modificar Vercel. No lo interpretes como falta de token.",
    }), null, 2));
    return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

