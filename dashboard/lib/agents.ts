import type { AgentAction, AgentId, AgentMetric, AgentSnapshot } from "./types";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  alias: string;
  role: string;
  container: string;
  secondaryContainers?: string[];
  healthUrl?: string;
  localUrl?: string;
  currentModel?: string;
  actions: AgentAction[];
  metrics: AgentMetric;
  channels: AgentSnapshot["channels"];
};

const baseMetrics: Record<AgentId, AgentMetric> = {
  colega: {
    messagesSent: 42,
    tasksCompleted: 11,
    modelCalls: 38,
    inputTokens: 92000,
    outputTokens: 21000,
    estimatedUsd: 2.8,
  },
  coach: {
    messagesSent: 31,
    tasksCompleted: 9,
    modelCalls: 27,
    inputTokens: 76000,
    outputTokens: 18000,
    estimatedUsd: 2.1,
  },
  socio: {
    messagesSent: 63,
    tasksCompleted: 16,
    modelCalls: 55,
    inputTokens: 146000,
    outputTokens: 39200,
    estimatedUsd: 4.6,
  },
};

export const agentDefinitions: AgentDefinition[] = [
  {
    id: "colega",
    name: "Colega",
    alias: "Academic",
    role: "Investigacion, lectura academica y OpenClaw",
    container: "colega",
    healthUrl: "http://127.0.0.1:18789/health",
    localUrl: "http://127.0.0.1:18789",
    currentModel: "fast: gpt-5.4-mini / standard: gpt-5.4 / deep: gpt-5.3-codex",
    actions: [
      "start",
      "stop",
      "restart",
      "queue_daily",
      "queue_nightly",
      "queue_sunday",
      "setup_colega_cron_preview",
      "audit_models",
      "discover_models",
      "logs",
      "open",
    ],
    metrics: baseMetrics.colega,
    channels: [
      { id: "colega-web", type: "local_web", label: "OpenClaw Web", status: "active", url: "http://127.0.0.1:18789" },
      { id: "colega-email", type: "email", label: "Email propio", status: "planned", requiredSecrets: ["academic_GMAIL_BOT_EMAIL", "academic_GMAIL_BOT_APP_PASSWORD"] },
      { id: "colega-slack", type: "slack", label: "Slack", status: "planned", requiredSecrets: ["academic_SLACK_BOT_TOKEN", "academic_SLACK_APP_TOKEN"] },
      { id: "colega-google", type: "google_workspace", label: "Drive Docs Calendar", status: "planned", requiredSecrets: ["academic_GOOGLE_CLIENT_ID", "academic_GOOGLE_CLIENT_SECRET", "academic_GOOGLE_REFRESH_TOKEN"] },
      { id: "colega-telegram", type: "telegram", label: "Telegram", status: "planned" },
    ],
  },
  {
    id: "coach",
    name: "Coach",
    alias: "Personal",
    role: "Claude Code, desarrollo y automatizacion del repo",
    container: "personal",
    currentModel: "fast: haiku / standard: sonnet / deep: opus / planning: opusplan",
    actions: ["start", "stop", "restart", "validate", "queue_daily", "queue_nightly", "queue_sunday", "audit_models", "discover_models", "logs"],
    metrics: baseMetrics.coach,
    channels: [
      { id: "coach-cli", type: "cli", label: "Claude CLI", status: "active", command: 'docker exec -it personal bash -lc "claude"' },
      { id: "coach-email", type: "email", label: "Email propio", status: "planned", requiredSecrets: ["personal_COACH_GMAIL_EMAIL", "personal_COACH_GMAIL_APP_PASSWORD"] },
      { id: "coach-slack", type: "slack", label: "Slack", status: "planned", requiredSecrets: ["personal_SLACK_BOT_TOKEN", "personal_SLACK_APP_TOKEN"] },
      { id: "coach-google", type: "google_workspace", label: "Drive Docs Calendar", status: "planned", requiredSecrets: ["personal_GOOGLE_CLIENT_ID", "personal_GOOGLE_CLIENT_SECRET", "personal_GOOGLE_REFRESH_TOKEN"] },
      { id: "coach-telegram", type: "telegram", label: "Telegram", status: "planned" },
    ],
  },
  {
    id: "socio",
    name: "Socio",
    alias: "Business",
    role: "Estrategia, negocios, Socio Lite API y modo Heavy noVNC",
    container: "business_agent",
    secondaryContainers: ["business_agent_daemon", "business_agent_heavy"],
    healthUrl: "http://127.0.0.1:8003/health",
    localUrl: "http://127.0.0.1:8003",
    currentModel: "fast: flash-lite / standard: flash / deep: pro",
    actions: [
      "start",
      "stop",
      "restart",
      "start_heavy",
      "stop_heavy",
      "rebuild_heavy",
      "start_slack_bridge",
      "stop_slack_bridge",
      "slack_bridge_logs",
      "start_deep_research_runner",
      "stop_deep_research_runner",
      "deep_research_runner_logs",
      "start_routine_orchestrator",
      "stop_routine_orchestrator",
      "routine_orchestrator_logs",
      "validate",
      "queue_daily",
      "queue_nightly",
      "queue_sunday",
      "audit_models",
      "discover_models",
      "logs",
      "open",
    ],
    metrics: baseMetrics.socio,
    channels: [
      { id: "socio-web", type: "local_web", label: "Modo Lite UI", status: "active", url: "http://127.0.0.1:8003" },
      { id: "socio-api", type: "local_api", label: "Modo Lite API", status: "active", requiresToken: true },
      { id: "socio-heavy-vnc", type: "heavy_vnc", label: "Modo Heavy noVNC", status: "planned", url: "http://127.0.0.1:6080", requiresToken: true },
      { id: "socio-email", type: "email", label: "Email propio", status: "planned", requiredSecrets: ["business_SOCIO_GMAIL_EMAIL", "business_SOCIO_GMAIL_APP_PASSWORD"] },
      { id: "socio-slack", type: "slack", label: "Slack", status: "planned", requiredSecrets: ["business_SLACK_BOT_TOKEN", "business_SLACK_APP_TOKEN"] },
      { id: "socio-google", type: "google_workspace", label: "Drive Docs Calendar", status: "planned", requiredSecrets: ["business_GOOGLE_CLIENT_ID", "business_GOOGLE_CLIENT_SECRET", "business_GOOGLE_REFRESH_TOKEN"] },
      { id: "socio-telegram", type: "telegram", label: "Telegram", status: "planned" },
    ],
  },
];


