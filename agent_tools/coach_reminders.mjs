import fs from "node:fs";
import path from "node:path";
import { appendConversation, readEnvFile, readLastSlackRoute, repoRoot } from "./slack_memory.mjs";

const runtimeDir = path.join(repoRoot, "logs", "runtime", "coach-reminders");
const stateFile = path.join(runtimeDir, "state.json");
const pidFile = path.join(runtimeDir, "coach-reminders.pid");
const logFile = path.join(repoRoot, "logs", "coach-reminders.log");
const remindersFile = path.join(repoRoot, "personal_agent", "reminders.json");

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(pidFile, String(process.pid), "utf8");

function cleanupPid() {
  try {
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) {
      fs.rmSync(pidFile, { force: true });
    }
  } catch {
    // best effort
  }
}

process.on("exit", cleanupPid);
process.on("SIGINT", () => {
  cleanupPid();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupPid();
  process.exit(0);
});

function log(message) {
  const line = `\n- [${new Date().toISOString()}] ${message}`;
  fs.appendFileSync(logFile, line, "utf8");
  console.log(message);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}

function bogotaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: String(parts.weekday || "").toLowerCase(),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function resolveChannel() {
  const env = readEnvFile(path.join(repoRoot, "secrets", "runtime", "personal.env"));
  const route = readLastSlackRoute("coach");
  return {
    token: env.SLACK_BOT_TOKEN || "",
    channel: env.SLACK_CHANNEL_ID || route.channel || "",
    user: route.user || "",
  };
}

async function postSlack(text) {
  const { token, channel, user } = resolveChannel();
  if (!token || !channel) throw new Error("Falta SLACK_BOT_TOKEN o canal Slack de Coach.");
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "slack_error");
  appendConversation("coach", {
    direction: "out",
    role: "assistant",
    agentName: "Coach",
    text,
    channel,
    user,
    model: "coach-reminder",
    routine: "reminder",
  });
}

function due(reminder, now, state) {
  if (!reminder.enabled) return false;
  if (String(reminder.day || "").toLowerCase() !== now.weekday) return false;
  if (String(reminder.time || "") !== now.time) return false;
  return state[reminder.id] !== now.dateKey;
}

async function tick() {
  const config = readJson(remindersFile, { reminders: [] });
  const state = readJson(stateFile, {});
  const now = bogotaParts();
  for (const reminder of config.reminders || []) {
    if (!due(reminder, now, state)) continue;
    await postSlack(reminder.message);
    state[reminder.id] = now.dateKey;
    writeState(state);
    log(`Recordatorio enviado: ${reminder.id}`);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  log("Coach reminders activo.");
  do {
    try {
      await tick();
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (true);
}

await main();


