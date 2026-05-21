import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");

const activeRoot = path.join(repoRoot, "logs", "runtime", "active-tasks");
const archiveRoot = path.join(repoRoot, "logs", "runtime", "active-tasks-archive");

fs.mkdirSync(activeRoot, { recursive: true });
fs.mkdirSync(archiveRoot, { recursive: true });

function safePart(value = "") {
  return String(value || "unknown").replace(/[^a-z0-9_.-]/gi, "-").slice(0, 80);
}

function todayBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function ledgerPath(agentId, kind, routeKey = "default") {
  return path.join(activeRoot, safePart(agentId), `${safePart(kind)}-${safePart(routeKey)}.json`);
}

function archivePath(agentId, kind, routeKey = "default") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(archiveRoot, safePart(agentId), `${safePart(kind)}-${safePart(routeKey)}-${stamp}.json`);
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function routeKey(event = {}) {
  return `${event.channel || "channel"}-${event.user || "user"}`;
}

function isGymText(text = "") {
  return /\b(gym|workout|rutina|ejercicio|exercise|press|curl|row|pulldown|raise|triceps|biceps|hombro|shoulder|caminadora|walking|running|machine|sets?|series?|reps?|x\s*\d+|\d+\s*(kg|lbs?))\b/i.test(
    String(text || ""),
  );
}

function isLikelyNarrative(text = "") {
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean).length;
  return words > 55 || /\b(report|reporte|life wiki|social event|historia|story|ayer|yesterday|memories|recuerdos|kissing|beso|amigo|friend)\b/i.test(value);
}

function hasGymMetrics(text = "") {
  const value = String(text || "");
  const numberMatches = value.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  return (
    /\b\d+\s*[x×]\s*\d+\b/i.test(value) ||
    /\b\d+(?:[.,]\d+)?\s+\d+\s*[x×]\s*\d+\b/i.test(value) ||
    /\b\d+(?:[.,]\d+)?\s*(kg|lbs?|kilos?|libras?|min|minutes|minutos|cal|calories|calorias|calor[ií]as)\b/i.test(value) ||
    numberMatches.length >= 2
  );
}

function hasExerciseName(text = "") {
  return /\b(chest\s*press|pec\s*fly|rear\s*delt|lat\s*pulldown|pulldown|row|curl|biceps?|triceps?|press|shoulder|hombro|jal[oó]n|caminadora|walking\s*machine|scaling\s*machine|el[ií]ptica|squat|sentadilla|peso\s*muerto|deadlift|leg\s*press|hip\s*adduction|leg\s*extension|calf\s*extension|glute|legs?\s*curl|seated\s*legs?\s*curl)\b/i.test(
    String(text || ""),
  );
}

function isExplicitGymStartText(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (isLikelyNarrative(value)) return false;
  if (/\b(tomorrow|ma[nñ]ana|later|despu[eé]s)\b/i.test(value) && !/\b(start|inicio|iniciar|empez|track|log|registr|anota)\b/i.test(value)) {
    return false;
  }
  const hasExplicitIntent =
    /\b(start|inicio|iniciar|empez(?:ar|amos|o)?|track|tracking|log|record|registr[aoe]?|registra|anota|apunta|lleva|sigue|rutina de (?:gym|gimnasio)|workout de hoy|today'?s workout|gym workout)\b/i.test(
      value,
    ) && isGymText(value);
  return hasExplicitIntent || (hasExerciseName(value) && hasGymMetrics(value));
}

function isGymContinuationText(text = "") {
  const value = String(text || "").trim();
  if (!value || isLikelyNarrative(value)) return false;
  return isGymText(value) && (hasExerciseName(value) || hasGymMetrics(value));
}

function isFinishText(text = "") {
  return /^\s*(finish|finished|finish the gym|termin[eé]|termine|termin[eé] el gym|listo|ya termin[eé]|cerrar rutina|resumen final)\s*[.!?]*\s*$/i.test(String(text || ""));
}

function hasFinishSignal(text = "") {
  return isFinishText(text) || /\b(and\s+finish|finish(?:ed)?\s+(?:the\s+)?(?:gym|workout|rutina)|termin[eé]\s+(?:el\s+)?(?:gym|gimnasio|entrenamiento))\b/i.test(String(text || ""));
}

function isFoodText(text = "") {
  const value = String(text || "");
  if (/\b(machine|caminadora|walking|running|scaling|elliptical|el[ií]ptica|cardio|exercise|gym|workout)\b/i.test(value)) {
    return false;
  }
  return /\b(comida|meal|protein|prote[ií]na|carbs?|grasa|macros?|desayuno|almuerzo|cena|snack|ate|com[ií]|almorc[eé]|cen[eé])\b/i.test(value);
}

function isExplicitExpenseText(text = "") {
  const value = String(text || "").trim();
  const hasMoney = /(?:\$|cop\b|pesos?\b|\b\d{3,}(?:[.,]\d{3})*\b|\b\d+(?:[.,]\d+)?\s*(?:k|mil)\b)/i.test(value);
  const hasExpenseVerb = /\b(pagu[eé]|pague|paid|gast[eé]|gaste|spent|compr[eé]|compre|bought|registr[ae]|registra|anota|agrega|a[nñ]ade|log|record)\b/i.test(
    value,
  );
  const hasExpenseNoun = /\b(gasto|gastos|expense|expenses|pago|compra|transmilenio|uber|taxi|restaurant|restaurante|entrada|suscripci[oó]n)\b/i.test(
    value,
  );

  return (hasExpenseVerb && (hasExpenseNoun || hasMoney)) || (hasExpenseNoun && hasMoney);
}

function ledgerKindForText(agentId, text = "") {
  const id = String(agentId || "").toLowerCase();
  const value = String(text || "");
  if (id !== "coach") return "";
  if (isExplicitGymStartText(value)) return "gym";
  if (isFoodText(value)) return "food";
  if (isExplicitExpenseText(value)) return "expenses";
  return "";
}

function extractExercise(text = "") {
  let clean = String(text || "").replace(/\s+/g, " ").trim();
  const focused = clean.match(
    /\b((?:(?:seated\s+)?(?:leg\s+press|legs?\s+curl)|hip\s+adduction|leg\s+extension|calf\s+extension|glute|scaling\s+machine|walking\s+machine|caminadora|lat\s+pulldown|pulldown|chest\s+press|pec\s+fly|rear\s+delt|row|biceps?\s+curl|triceps?\s+press|shoulder\s+press)[^!?]*)/i,
  );
  if (focused) clean = focused[1].trim();
  const seriesReps = clean.match(/(\d+)\s*[x×]\s*(\d+)/i);
  const explicitWeight = clean.match(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?|kilos?|libras?)\b/i);
  const implicitWeight = clean.match(/\b(\d+(?:[.,]\d+)?)\s+\d+\s*[x×]\s*\d+\b/i);
  const weight = explicitWeight
    ? `${explicitWeight[1].replace(",", ".")} ${explicitWeight[2]}`
    : implicitWeight
      ? implicitWeight[1].replace(",", ".")
      : "";
  const minutes = clean.match(/(\d+(?:[.,]\d+)?)\s*(min|minutes|minutos)\b/i);
  const calories = clean.match(/(\d+(?:[.,]\d+)?)\s*(cal|calories|calorias|calor[ií]as)\b/i);
  let name = clean
    .replace(/^.*?\b(?:i start(?: now)? with|start(?: now)? with|register .*? with)\b/gi, " ")
    .replace(/\b(after|next|next one was|correct was|and after|was|after was|i start with|ok main while less track today gym workout|keep that|and finish|finish)\b/gi, " ")
    .replace(/\d+(?:[.,]\d+)?\s*(kg|lbs?|kilos?|libras?|min|minutes|minutos|cal|calories|calorias|calor[ií]as)\b/gi, " ")
    .replace(/\b\d+\s*[x×]\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length < 3) name = clean.slice(0, 80);
  return {
    raw: clean,
    name: name.slice(0, 120),
    weight,
    series: seriesReps ? Number(seriesReps[1]) : null,
    reps: seriesReps ? Number(seriesReps[2]) : null,
    minutes: minutes ? Number(minutes[1].replace(",", ".")) : null,
    calories: calories ? Number(calories[1].replace(",", ".")) : null,
    timestamp: new Date().toISOString(),
  };
}

export function updateLedgerFromSlack(agentId, event, text) {
  const id = String(agentId || "").toLowerCase();
  if (id !== "coach") return null;
  const message = String(text || "").trim();
  if (!message) return null;

  const detectedKind = ledgerKindForText(id, message);
  const key = routeKey(event);
  let kind = detectedKind;
  let filePath = kind ? ledgerPath(id, kind, key) : "";
  let existing = filePath ? readJson(filePath, null) : null;

  if (!existing && !detectedKind) {
    for (const candidateKind of ["gym", "expenses", "food", "interactions"]) {
      const candidate = readJson(ledgerPath(id, candidateKind, key), null);
      if (candidate?.status === "active" || candidate?.status === "closing") {
        kind = candidateKind;
        filePath = ledgerPath(id, candidateKind, key);
        existing = candidate;
        break;
      }
    }
  }

  if (!existing && !detectedKind) return null;

  if (existing && !detectedKind && !hasFinishSignal(message)) {
    if (existing.kind === "gym" && isGymContinuationText(message)) {
      kind = existing.kind;
      filePath = ledgerPath(id, kind, key);
    } else {
    existing.updatedAt = new Date().toISOString();
    existing.needsUserDecision = true;
    existing.notes = Array.isArray(existing.notes) ? existing.notes : [];
    existing.notes.push({
      timestamp: new Date().toISOString(),
      text: message,
      type: "possible_topic_shift",
    });
    writeJson(filePath, existing);
    return existing;
    }
  }

  if (existing && detectedKind && existing.kind !== detectedKind) {
    existing.updatedAt = new Date().toISOString();
    existing.needsUserDecision = true;
    existing.notes = Array.isArray(existing.notes) ? existing.notes : [];
    existing.notes.push({
      timestamp: new Date().toISOString(),
      text: message,
      type: `possible_new_${detectedKind}_while_${existing.kind}_active`,
    });
    writeJson(filePath, existing);
    return existing;
  }

  kind = kind || existing?.kind || "gym";
  filePath = filePath || ledgerPath(id, kind, key);

  const ledger =
    existing || {
      agentId: id,
      kind,
      routeKey: key,
      date: todayBogota(),
      status: "active",
      startedAt: new Date().toISOString(),
      source: "slack",
      entries: [],
      notes: [],
    };

  ledger.updatedAt = new Date().toISOString();
  ledger.needsUserDecision = false;

  if (hasFinishSignal(message) && !(kind === "gym" && isGymContinuationText(message) && !isFinishText(message))) {
    ledger.status = "closing";
    ledger.notes.push({ timestamp: new Date().toISOString(), text: message, type: "finish_signal" });
  } else if (kind === "gym" && isGymContinuationText(message)) {
    ledger.entries.push(extractExercise(message));
    if (hasFinishSignal(message)) {
      ledger.status = "closing";
      ledger.notes.push({ timestamp: new Date().toISOString(), text: message, type: "finish_signal" });
    }
  } else if (kind === "gym") {
    ledger.needsUserDecision = true;
    ledger.notes.push({ timestamp: new Date().toISOString(), text: message, type: "non_gym_topic_while_gym_active" });
  } else if (kind === "expenses" && !isExplicitExpenseText(message)) {
    ledger.notes.push({ timestamp: new Date().toISOString(), text: message, type: "conversation_note" });
  } else if (kind === "food" && !isFoodText(message)) {
    ledger.notes.push({ timestamp: new Date().toISOString(), text: message, type: "conversation_note" });
  } else {
    ledger.entries.push({ raw: message, name: message.slice(0, 140), timestamp: new Date().toISOString() });
  }

  writeJson(filePath, ledger);
  return ledger;
}

export function finalizeLedgerIfNeeded(agentId, event, text) {
  const id = String(agentId || "").toLowerCase();
  if (id !== "coach" || !hasFinishSignal(text)) return null;
  const key = routeKey(event);
  const closed = [];
  for (const kind of ["gym", "expenses", "food", "interactions"]) {
    const filePath = ledgerPath(id, kind, key);
    const ledger = readJson(filePath, null);
    if (!ledger) continue;
    ledger.status = "done";
    ledger.finishedAt = new Date().toISOString();
    const target = archivePath(id, kind, key);
    writeJson(target, ledger);
    fs.rmSync(filePath, { force: true });
    closed.push({ ledger, archivedAt: target });
  }
  return closed[0] || null;
}

export function ledgerPromptBlock(agentId, event = {}) {
  const id = String(agentId || "").toLowerCase();
  const key = routeKey(event);
  const ledgers = [];
  for (const kind of ["gym", "expenses", "food", "interactions"]) {
    const item = readJson(ledgerPath(id, kind, key), null);
    if (item) ledgers.push(item);
  }
  if (ledgers.length === 0) {
    return "Ledger temporal activo: ninguno.";
  }
  const blocks = ledgers.map((ledger) => {
    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    const lines = entries.slice(-20).map((entry, index) => {
      const details = [
        entry.weight && `peso=${entry.weight}`,
        entry.series && `series=${entry.series}`,
        entry.reps && `reps=${entry.reps}`,
        entry.minutes && `min=${entry.minutes}`,
        entry.calories && `cal=${entry.calories}`,
      ]
        .filter(Boolean)
        .join(", ");
      return `${index + 1}. ${entry.name || entry.raw}${details ? ` (${details})` : ""}`;
    });
    return [
      `Ledger ${ledger.kind} (${ledger.status}, ${ledger.date}):`,
      ...lines,
      "Regla: para resumen final usa este ledger + Notion, no solo memoria conversacional.",
      "Regla: si el usuario cambia de tema o pide Life Wiki/Notion/reportes narrativos, cierra o ignora este ledger antes de acumular mas datos.",
      "Regla: cardio con calorias sigue siendo gym, no comida.",
      ledger.needsUserDecision
        ? "Atencion: el ultimo mensaje parece cambio de tema. Pregunta si debes cerrar este ledger antes de seguir acumulando datos."
        : "",
    ].join("\n");
  });
  return blocks.join("\n\n");
}

