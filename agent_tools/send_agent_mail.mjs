#!/usr/bin/env node
import net from "node:net";
import tls from "node:tls";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AGENTS = {
  colega: {
    name: "Colega",
    emailKey: "GMAIL_BOT_EMAIL",
    passwordKey: "GMAIL_BOT_APP_PASSWORD",
  },
  coach: {
    name: "Coach",
    emailKey: "COACH_GMAIL_EMAIL",
    passwordKey: "COACH_GMAIL_APP_PASSWORD",
  },
  socio: {
    name: "Socio",
    emailKey: "SOCIO_GMAIL_EMAIL",
    passwordKey: "SOCIO_GMAIL_APP_PASSWORD",
  },
};

function usage() {
  console.error("Uso: node send_agent_mail.mjs --agent <colega|coach|socio> --to <email> --subject <texto> (--body <texto>|--body-file <path>)");
  process.exit(2);
}

function args() {
  const out = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    const key = process.argv[i];
    if (!key.startsWith("--")) usage();
    const value = process.argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

function encodeHeader(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function emailLogCandidates() {
  const explicit = process.env.AGENT_EMAIL_LOG_FILE;
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.AGENT_DATA_DIR) {
    candidates.push(path.join(process.env.AGENT_DATA_DIR, "logs", "email-sends.jsonl"));
  }
  candidates.push(path.join(process.cwd(), "logs", "runtime", "email-sends.jsonl"));
  candidates.push(path.join(process.cwd(), "..", "logs", "runtime", "email-sends.jsonl"));
  candidates.push(path.join(__dirname, "..", "logs", "runtime", "email-sends.jsonl"));
  candidates.push("/app/data/logs/email-sends.jsonl");
  candidates.push("/data/openclaw/logs/email-sends.jsonl");
  return [...new Set(candidates.map((item) => path.resolve(item)))];
}

function appendEmailLog(record) {
  const entry = {
    timestamp: new Date().toISOString(),
    tool: "agent_tools/send_agent_mail.mjs",
    ...record,
  };
  for (const filePath of emailLogCandidates()) {
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
      return filePath;
    } catch {
      // Try next writable location.
    }
  }
  return null;
}

function sha256(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function makeMessage({ from, fromName, to, subject, body }) {
  const nonce = randomUUID();
  const messageId = `<${nonce}@agents.local>`;
  const safeSubject = encodeHeader(subject);
  const safeFromName = encodeHeader(fromName);
  const message = [
    `From: "${safeFromName}" <${from}>`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "X-Agent-Mailer: D-Agents agent_tools/send_agent_mail.mjs",
    "",
    body,
    "",
  ].join("\r\n");
  return { message, messageId };
}

function normalizePassword(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) {
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    setTimeout(() => {
      socket.off("data", onData);
      reject(new Error("SMTP timeout esperando respuesta"));
    }, 45000).unref();
  });
}

async function sendCommand(socket, command, okCodes) {
  if (command) socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!okCodes.includes(code)) {
    throw new Error(`SMTP ${code}: ${response.split(/\r?\n/)[0]}`);
  }
  return response;
}

function connectPlain(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.setTimeout(45000);
    socket.once("timeout", () => reject(new Error("SMTP connect timeout")));
    socket.once("error", reject);
  });
}

async function main() {
  const options = args();
  const agent = AGENTS[String(options.agent || "").toLowerCase()];
  if (!agent || !options.to || !options.subject || (!options.body && !options["body-file"])) usage();

  const from = String(process.env[agent.emailKey] || "").trim();
  const password = normalizePassword(process.env[agent.passwordKey]);
  if (!from || !password) {
    throw new Error(`${agent.name}: variables ${agent.emailKey}/${agent.passwordKey} ausentes`);
  }

  const body = options["body-file"] ? readFileSync(options["body-file"], "utf8") : String(options.body);
  const { message, messageId } = makeMessage({
    from,
    fromName: agent.name,
    to: options.to,
    subject: options.subject,
    body,
  });

  let socket = await connectPlain("smtp.gmail.com", 587);
  await sendCommand(socket, null, [220]);
  await sendCommand(socket, "EHLO agents.local", [250]);
  await sendCommand(socket, "STARTTLS", [220]);
  socket = tls.connect({ socket, servername: "smtp.gmail.com" });
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
  await sendCommand(socket, "EHLO agents.local", [250]);
  const auth = Buffer.from(`\0${from}\0${password}`, "utf8").toString("base64");
  await sendCommand(socket, `AUTH PLAIN ${auth}`, [235]);
  await sendCommand(socket, `MAIL FROM:<${from}>`, [250]);
  await sendCommand(socket, `RCPT TO:<${options.to}>`, [250, 251]);
  await sendCommand(socket, "DATA", [354]);
  socket.write(`${message.replace(/\r?\n\./g, "\r\n..")}\r\n.\r\n`);
  await sendCommand(socket, null, [250]);
  await sendCommand(socket, "QUIT", [221]);
  socket.end();

  appendEmailLog({
    status: "sent",
    agent: agent.name,
    from,
    to: options.to,
    subject: encodeHeader(options.subject),
    messageId,
    bodySha256: sha256(body),
    bodyChars: body.length,
  });
  console.log(`EMAIL_SENT agent=${agent.name} from=${from} to=${options.to} subject="${encodeHeader(options.subject)}" message_id=${messageId}`);
}

main().catch((error) => {
  try {
    const options = args();
    const agent = AGENTS[String(options.agent || "").toLowerCase()];
    appendEmailLog({
      status: "failed",
      agent: agent?.name || String(options.agent || ""),
      to: options.to || "",
      subject: options.subject ? encodeHeader(options.subject) : "",
      error: error instanceof Error ? error.message : String(error),
    });
  } catch {
    appendEmailLog({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  console.error(`EMAIL_FAILED ${error.message}`);
  process.exit(1);
});

