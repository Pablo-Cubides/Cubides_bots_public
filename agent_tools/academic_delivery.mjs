#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const AGENTS = new Set(["colega", "coach", "socio"]);

function usage() {
  console.error([
    "Uso:",
    "  node academic_delivery.mjs --agent colega --to <email> --title <titulo> --report-file <markdown> [--category Investigacion] [--summary-file <txt>] [--send-email true|false] [--create-doc true|false]",
    "",
    "Entrega un reporte ya producido: crea Google Doc opcional y envia correo con resumen/enlace.",
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

function boolArg(value, fallback = true) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function safeSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 180);
}

function assertReadableFile(filePath, label) {
  if (!filePath) throw new Error(`Falta ${label}`);
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`${label} no es archivo: ${resolved}`);
  return resolved;
}

function runNode(scriptName, args) {
  const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), scriptName);
  const normalized = process.platform === "win32" && scriptPath.startsWith("/") ? scriptPath.slice(1) : scriptPath;
  const result = spawnSync(process.execPath, [normalized, ...args], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "").trim();
    throw new Error(`${scriptName} fallo: ${message}`);
  }
  return result.stdout.trim();
}

function extractJson(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`No hubo JSON en salida: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(start, end + 1));
}

function firstParagraph(markdown) {
  const cleaned = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return cleaned.slice(0, 5).join("\n").slice(0, 1600);
}

function buildEmailBody({ title, summary, docLink, reportText }) {
  const lines = [
    `Hola, Primary User.`,
    "",
    `Te dejo la entrega academica solicitada: ${title}.`,
    "",
  ];
  if (summary) {
    lines.push("Resumen:");
    lines.push(summary);
    lines.push("");
  }
  if (docLink) {
    lines.push(`Documento en Drive/Docs: ${docLink}`);
    lines.push("");
  }
  if (!docLink) {
    lines.push("Contenido:");
    lines.push(reportText.slice(0, 12000));
    if (reportText.length > 12000) {
      lines.push("");
      lines.push("[Contenido truncado para correo. Revisa el archivo original en el workspace del agente.]");
    }
  }
  lines.push("");
  lines.push("Colega");
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const agent = String(options.agent || "").toLowerCase();
  if (!AGENTS.has(agent)) usage();
  if (agent !== "colega") throw new Error("academic_delivery v1 esta optimizado para Colega; usa --agent colega");
  if (!options.to || !options.title || !options["report-file"]) usage();

  const reportFile = assertReadableFile(options["report-file"], "--report-file");
  const reportText = fs.readFileSync(reportFile, "utf8");
  const title = safeSubject(options.title);
  const category = options.category || "Investigacion";
  const createDoc = boolArg(options["create-doc"], true);
  const sendEmail = boolArg(options["send-email"], true);
  const summary = options["summary-file"]
    ? fs.readFileSync(assertReadableFile(options["summary-file"], "--summary-file"), "utf8").trim()
    : firstParagraph(reportText);

  let doc = null;
  if (createDoc) {
    const stdout = runNode("google_workspace.mjs", [
      "--agent", agent,
      "--action", "create-doc",
      "--title", title,
      "--category", category,
      "--body-file", reportFile,
    ]);
    const parsed = extractJson(stdout);
    doc = parsed.doc || null;
  }

  let emailSent = false;
  if (sendEmail) {
    const body = buildEmailBody({
      title,
      summary,
      docLink: doc?.webViewLink,
      reportText,
    });
    const bodyFile = path.join(os.tmpdir(), `colega-delivery-${Date.now()}.txt`);
    fs.writeFileSync(bodyFile, body, "utf8");
    try {
      runNode("send_agent_mail.mjs", [
        "--agent", agent,
        "--to", options.to,
        "--subject", `[Colega] ${title}`,
        "--body-file", bodyFile,
      ]);
      emailSent = true;
    } finally {
      fs.rmSync(bodyFile, { force: true });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    agent,
    title,
    doc: doc ? { id: doc.id, name: doc.name, webViewLink: doc.webViewLink } : null,
    emailSent,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


