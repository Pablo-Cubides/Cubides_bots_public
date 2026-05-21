export type AgentId = "colega" | "coach" | "socio";

export type AgentStatus = "healthy" | "starting" | "idle" | "working" | "warning" | "error" | "offline";

export type AvatarState = "idle" | "walking" | "typing" | "working" | "warning" | "error";

export type AgentChannelType = "local_web" | "local_api" | "cli" | "heavy_vnc" | "email" | "slack" | "google_workspace" | "telegram";

export type ChannelStatus = "active" | "configured" | "planned" | "disabled" | "error";

export type AgentAction =
  | "start"
  | "stop"
  | "restart"
  | "rebuild"
  | "validate"
  | "queue_daily"
  | "queue_nightly"
  | "queue_sunday"
  | "start_heavy"
  | "stop_heavy"
  | "restart_heavy"
  | "rebuild_heavy"
  | "audit_models"
  | "discover_models"
  | "start_slack_bridge"
  | "stop_slack_bridge"
  | "slack_bridge_logs"
  | "start_deep_research_runner"
  | "stop_deep_research_runner"
  | "deep_research_runner_logs"
  | "start_routine_orchestrator"
  | "stop_routine_orchestrator"
  | "routine_orchestrator_logs"
  | "setup_colega_cron_preview"
  | "logs"
  | "open";

export type ModelPhase = "fast" | "standard" | "deep" | "planning" | "experimental" | "fallback";

export type ModelAccessStatus = "ok" | "listed" | "candidate" | "limited" | "no_access" | "deprecated" | "experimental" | "failed";

export type ModelAccessRecord = {
  agent: "colega" | "coach" | "socio";
  provider: "openai-codex" | "claude-oauth" | "gemini-cli" | "openrouter";
  model: string;
  phase: ModelPhase;
  status: ModelAccessStatus;
  notes: string;
};

export type ModelDiscoveryResponse = {
  generatedAt: string;
  probesRun: boolean;
  dockerAvailable: boolean;
  models: ModelAccessRecord[];
  events: Array<{ severity: "info" | "warning" | "error"; message: string }>;
};

export type AgentChannel = {
  id: string;
  type: AgentChannelType;
  label: string;
  status: ChannelStatus;
  url?: string;
  command?: string;
  requiresToken?: boolean;
  requiredSecrets?: string[];
};

export type AgentMetric = {
  messagesSent: number;
  tasksCompleted: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
};

export type AgentEvent = {
  id: string;
  timestamp: string;
  agentId: AgentId | "system";
  severity: "info" | "success" | "warning" | "error";
  message: string;
};

export type RuntimeInfo = {
  containerName: string;
  dockerStatus: string;
  dockerHealth: "healthy" | "unhealthy" | "starting" | "none" | "unknown";
  running: boolean;
  ports: string;
};

export type AgentSnapshot = {
  id: AgentId;
  name: string;
  alias: string;
  role: string;
  status: AgentStatus;
  avatarState: AvatarState;
  currentModel?: string;
  healthUrl?: string;
  localUrl?: string;
  runtime: RuntimeInfo;
  runtimeDetails?: RuntimeInfo[];
  lastActivityAt?: string;
  error?: {
    code: string;
    message: string;
    source: "health" | "token" | "model" | "channel" | "runtime";
  };
  channels: AgentChannel[];
  actions: AgentAction[];
  metrics: AgentMetric;
};

export type SnapshotResponse = {
  generatedAt: string;
  protected: boolean;
  tokenSources: {
    dashboardAdminToken: boolean;
    agentAdminToken: boolean;
    vncPassword: boolean;
  };
  secretPresence: Record<string, boolean>;
  integrations: {
    slackBridge: {
      running: boolean;
      status: string;
      processIds: number[];
      logPath: string;
    };
    deepResearchRunner: {
      running: boolean;
      status: string;
      processIds: number[];
      logPath: string;
    };
    routineOrchestrator: {
      running: boolean;
      status: string;
      processIds: number[];
      logPath: string;
    };
    colegaOpenClawCron: {
      configured: boolean;
      status: string;
      updatedAt?: string;
    };
  };
  routines?: Array<{
    agentId: AgentId;
    routineId: string;
    status: string;
    updatedAt?: string;
    lastRunLocal?: string;
    error?: string;
  }>;
  agents: AgentSnapshot[];
  events: AgentEvent[];
  modelUsage: Array<{
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
  }>;
};

export type ActionResponse = {
  ok: boolean;
  commandLabel: string;
  output: string;
};

