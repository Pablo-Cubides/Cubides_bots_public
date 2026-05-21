#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const wikiRoot = path.join(repoRoot, "personal_agent", "life_wiki");

const coreDirs = ["raw", "situations", "patterns", "domains", "experiments", "weekly_reviews"];
const coreFiles = ["README.md", "SCHEMA.md", "index.md", "log.md"];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return `Uso:
  node agent_tools/life_wiki.mjs status
  node agent_tools/life_wiki.mjs ingest --domain relaciones --title "Titulo" --text "Texto" [--source slack] [--tags a,b] [--dry-run]
  node agent_tools/life_wiki.mjs new-pattern --domain salud --title "Patron" --summary "Resumen" [--situations archivo1,archivo2] [--dry-run]
  node agent_tools/life_wiki.mjs search --query "texto" [--limit 10]
  node agent_tools/life_wiki.mjs lint
`;
}

function ensureStructure() {
  fs.mkdirSync(wikiRoot, { recursive: true });
  for (const dir of coreDirs) {
    fs.mkdirSync(path.join(wikiRoot, dir), { recursive: true });
  }
}

function bogotaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return parts;
}

function todayBogota() {
  const p = bogotaDateParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function nowBogota() {
  const p = bogotaDateParts();
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} America/Bogota`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "entrada";
}

function mdEscape(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function rel(filePath) {
  return path.relative(wikiRoot, filePath).replace(/\\/g, "/");
}

function countMarkdownFiles(dir) {
  const full = path.join(wikiRoot, dir);
  if (!fs.existsSync(full)) return 0;
  return fs.readdirSync(full).filter((name) => name.endsWith(".md")).length;
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeText(filePath, content, dryRun = false) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function appendText(filePath, content, dryRun = false) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, content, "utf8");
}

function appendLog(kind, title, filePath, dryRun = false) {
  appendText(path.join(wikiRoot, "log.md"), `\n- ${nowBogota()} | ${kind} | [${title}](${rel(filePath)})\n`, dryRun);
}

function appendIndex(sectionTitle, title, filePath, dryRun = false) {
  const indexPath = path.join(wikiRoot, "index.md");
  let content = readText(indexPath);
  if (!content) {
    content = "# Life Wiki Index\n\n## Situaciones Recientes\n\n## Patrones Activos\n\n## Experimentos Activos\n";
  }
  const entry = `- [${title}](${rel(filePath)})`;
  if (content.includes(entry)) return;
  const marker = `## ${sectionTitle}`;
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    content = `${content.trim()}\n\n${marker}\n\n${entry}\n`;
  } else {
    const nextMarker = content.indexOf("\n## ", markerIndex + marker.length);
    if (nextMarker === -1) {
      content = `${content.trim()}\n${entry}\n`;
    } else {
      content = `${content.slice(0, nextMarker).trim()}\n${entry}\n\n${content.slice(nextMarker).trimStart()}`;
    }
  }
  writeText(indexPath, content, dryRun);
}

function uniquePath(dir, baseName) {
  let candidate = path.join(wikiRoot, dir, `${baseName}.md`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(wikiRoot, dir, `${baseName}-${counter}.md`);
    counter += 1;
  }
  return candidate;
}

function getTextArg(args) {
  if (args["body-file"]) {
    const filePath = path.resolve(repoRoot, String(args["body-file"]));
    return readText(filePath);
  }
  return args.text || "";
}

function status() {
  ensureStructure();
  const counts = Object.fromEntries(coreDirs.map((dir) => [dir, countMarkdownFiles(dir)]));
  const files = Object.fromEntries(coreFiles.map((file) => [file, fs.existsSync(path.join(wikiRoot, file))]));
  return {
    ok: true,
    root: wikiRoot,
    counts,
    files,
  };
}

function ingest(args) {
  ensureStructure();
  const title = String(args.title || "").trim();
  const domain = slugify(args.domain || "general");
  const body = getTextArg(args);
  if (!title) throw new Error("Falta --title");
  if (!body.trim()) throw new Error("Falta --text o --body-file");

  const date = todayBogota();
  const slug = `${date}-${slugify(title)}`;
  const rawPath = uniquePath("raw", slug);
  const situationPath = uniquePath("situations", slug);
  const tags = String(args.tags || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const source = String(args.source || "manual");
  const dryRun = Boolean(args["dry-run"]);

  const rawMd = `# ${title}

- Fecha: ${nowBogota()}
- Fuente: ${source}
- Dominio inicial: ${domain}
- Tags: ${tags.length ? tags.join(", ") : "pendiente"}

## Entrada Original

${mdEscape(body)}
`;

  const situationMd = `# ${title}

- Fecha: ${nowBogota()}
- Dominio: ${domain}
- Fuente: ${source}
- Entrada raw: [${rel(rawPath)}](../${rel(rawPath)})
- Tags: ${tags.length ? tags.join(", ") : "pendiente"}

## Contexto

Pendiente de sintesis por Coach.

## Que Paso

${mdEscape(body)}

## Estado Interno Observado

Pendiente de sintesis por Coach.

## Decisiones O Acciones

Pendiente de sintesis por Coach.

## Resultado

Pendiente de seguimiento.

## Aprendizajes

Pendiente de sintesis por Coach.

## Posibles Patrones Relacionados

Pendiente.

## Siguiente Experimento

Pendiente.
`;

  writeText(rawPath, rawMd, dryRun);
  writeText(situationPath, situationMd, dryRun);
  appendLog("situacion", title, situationPath, dryRun);
  appendIndex("Situaciones Recientes", title, situationPath, dryRun);

  return {
    ok: true,
    dryRun,
    rawPath,
    situationPath,
  };
}

function newPattern(args) {
  ensureStructure();
  const title = String(args.title || "").trim();
  const domain = slugify(args.domain || "general");
  const summary = String(args.summary || "").trim();
  if (!title) throw new Error("Falta --title");
  if (!summary) throw new Error("Falta --summary");
  const dryRun = Boolean(args["dry-run"]);
  const patternPath = uniquePath("patterns", slugify(title));
  const situations = String(args.situations || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const content = `# ${title}

- Estado: activo
- Dominio: ${domain}
- Creado: ${nowBogota()}

## Resumen

${mdEscape(summary)}

## Situaciones Relacionadas

${situations.length ? situations.map((item) => `- ${item}`).join("\n") : "- Pendiente"}

## Hipotesis

Pendiente de formular con mas evidencia.

## Senales Tempranas

Pendiente.

## Intervencion Recomendada

Pendiente.

## Revision

Pendiente.
`;

  writeText(patternPath, content, dryRun);
  appendLog("patron", title, patternPath, dryRun);
  appendIndex("Patrones Activos", title, patternPath, dryRun);

  return { ok: true, dryRun, patternPath };
}

function walkMarkdown(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function search(args) {
  ensureStructure();
  const query = String(args.query || "").trim().toLowerCase();
  if (!query) throw new Error("Falta --query");
  const limit = Math.max(1, Number.parseInt(args.limit || "10", 10) || 10);
  const hits = [];
  for (const filePath of walkMarkdown(wikiRoot)) {
    const lines = readText(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hits.length >= limit) return;
      if (line.toLowerCase().includes(query)) {
        hits.push({
          file: rel(filePath),
          line: index + 1,
          preview: line.trim().slice(0, 220),
        });
      }
    });
    if (hits.length >= limit) break;
  }
  return { ok: true, query, hits };
}

function lint() {
  ensureStructure();
  const issues = [];
  for (const dir of coreDirs) {
    if (!fs.existsSync(path.join(wikiRoot, dir))) {
      issues.push({ severity: "error", message: `Falta directorio ${dir}` });
    }
  }
  for (const file of coreFiles) {
    if (!fs.existsSync(path.join(wikiRoot, file))) {
      issues.push({ severity: "warning", message: `Falta archivo ${file}` });
    }
  }

  for (const filePath of walkMarkdown(path.join(wikiRoot, "situations"))) {
    const content = readText(filePath);
    const pending = (content.match(/Pendiente/g) || []).length;
    if (pending >= 4) {
      issues.push({
        severity: "info",
        file: rel(filePath),
        message: "Situacion creada, pendiente de sintesis humana/Coach.",
      });
    }
  }

  for (const filePath of walkMarkdown(path.join(wikiRoot, "patterns"))) {
    const content = readText(filePath);
    if (!/## Situaciones Relacionadas/.test(content)) {
      issues.push({
        severity: "warning",
        file: rel(filePath),
        message: "Patron sin seccion de situaciones relacionadas.",
      });
    }
  }

  return { ok: !issues.some((issue) => issue.severity === "error"), issues };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let result;
  switch (command) {
    case "status":
      result = status(args);
      break;
    case "ingest":
      result = ingest(args);
      break;
    case "new-pattern":
      result = newPattern(args);
      break;
    case "search":
      result = search(args);
      break;
    case "lint":
      result = lint(args);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(usage());
      return;
    default:
      throw new Error(`Comando no reconocido: ${command}\n${usage()}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

