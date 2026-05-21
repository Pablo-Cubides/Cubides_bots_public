import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const AUDIO_MIME_RE = /^(audio|video)\//i;
const AUDIO_EXT_RE = /\.(aac|aif|aiff|amr|flac|m4a|mp3|mp4|mpeg|oga|ogg|opus|wav|webm|wma)$/i;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

function asBool(value, fallback = true) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function safeName(value, fallback = "audio") {
  const clean = String(value || "")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return clean || fallback;
}

function isAudioFile(file = {}) {
  const mime = String(file.mimetype || "");
  const name = String(file.name || file.title || "");
  const type = String(file.filetype || "");
  return AUDIO_MIME_RE.test(mime) || AUDIO_EXT_RE.test(name) || /^(mp3|m4a|wav|ogg|oga|opus|flac|webm|mp4)$/i.test(type);
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where.exe" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  try {
    const result = execFileAsync(checker, args, { timeout: 5000, windowsHide: true });
    return result.then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

async function downloadSlackFile(file, token, outputPath, maxBytes) {
  const url = file.url_private_download || file.url_private;
  if (!url) throw new Error("El archivo de Slack no trae URL privada de descarga.");

  let currentUrl = url;
  let response = null;
  for (let redirects = 0; redirects < 5; redirects += 1) {
    response = await fetch(currentUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "agents-slack-voice-gateway/1.0",
      },
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl).toString();
  }

  if (!response.ok) {
    throw new Error(`Slack rechazo la descarga del audio (${response.status}). Revisa scope files:read y reinstala la app.`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Audio demasiado grande (${contentLength} bytes). Limite local: ${maxBytes} bytes.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(`Audio demasiado grande (${arrayBuffer.byteLength} bytes). Limite local: ${maxBytes} bytes.`);
  }
  const bytes = Buffer.from(arrayBuffer);
  const firstBytes = bytes.subarray(0, 256).toString("utf8").trimStart();
  const contentType = String(response.headers.get("content-type") || "");
  if (/^<!doctype html/i.test(firstBytes) || /^<html/i.test(firstBytes) || /^text\/html/i.test(contentType)) {
    throw new Error("Slack devolvio HTML en vez del audio. Reinstala la app con files:read y verifica que el audio pertenece al mismo workspace/app.");
  }
  fs.writeFileSync(outputPath, bytes);
}

function readFirstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8").trim();
  }
  return "";
}

async function transcribeWithWhisperCpp(audioPath, workDir, env) {
  const bin = env.WHISPER_CPP_BIN || env.WHISPER_CLI_BIN || "whisper-cli";
  const model = env.WHISPER_CPP_MODEL || env.WHISPER_MODEL_PATH;
  if (!model) return null;
  if (!(await commandExists(bin))) return null;
  if (!fs.existsSync(model)) throw new Error(`WHISPER_CPP_MODEL no existe: ${model}`);

  const outputBase = path.join(workDir, "transcript");
  await execFileAsync(
    bin,
    ["-m", model, "-f", audioPath, "-otxt", "-of", outputBase, "-l", env.VOICE_TRANSCRIBE_LANGUAGE || "auto"],
    { cwd: workDir, timeout: Number(env.VOICE_TRANSCRIBE_TIMEOUT_MS || 300000), maxBuffer: 1024 * 1024 * 4, windowsHide: true },
  );
  const text = readFirstExisting([`${outputBase}.txt`, outputBase]);
  return text || null;
}

async function transcribeWithOpenAIWhisperCli(audioPath, workDir, env) {
  const bin = env.WHISPER_BIN || "whisper";
  if (!(await commandExists(bin))) return null;
  await execFileAsync(
    bin,
    [
      audioPath,
      "--model",
      env.LOCAL_WHISPER_MODEL || "small",
      "--language",
      env.VOICE_TRANSCRIBE_LANGUAGE || "Spanish",
      "--output_format",
      "txt",
      "--output_dir",
      workDir,
    ],
    { cwd: workDir, timeout: Number(env.VOICE_TRANSCRIBE_TIMEOUT_MS || 300000), maxBuffer: 1024 * 1024 * 4, windowsHide: true },
  );

  const parsed = path.parse(audioPath);
  return readFirstExisting([path.join(workDir, `${parsed.name}.txt`)]) || null;
}

async function transcribeWithFasterWhisper(audioPath, workDir, env) {
  const python = env.PYTHON_BIN || "python";
  if (!(await commandExists(python))) return null;
  const fixedScriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "voice", "transcribe_faster_whisper.py");
  if (!fs.existsSync(fixedScriptPath)) return null;

  const { stdout } = await execFileAsync(
    python,
    [
      fixedScriptPath,
      "--audio",
      audioPath,
      "--model",
      env.FASTER_WHISPER_MODEL || env.LOCAL_WHISPER_MODEL || "small",
      "--language",
      env.VOICE_TRANSCRIBE_LANGUAGE || "es",
    ],
    { cwd: workDir, timeout: Number(env.VOICE_TRANSCRIBE_TIMEOUT_MS || 300000), maxBuffer: 1024 * 1024 * 4, windowsHide: true },
  );
  return String(stdout || "").trim() || null;
}

async function transcribeWithVoiceTranscriber(audioPath, _workDir, env) {
  const url = String(env.VOICE_TRANSCRIBER_URL || "http://127.0.0.1:8011").replace(/\/+$/, "");
  if (!asBool(env.VOICE_TRANSCRIBER_ENABLED, true)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.VOICE_TRANSCRIBE_TIMEOUT_MS || 300000));
  try {
    const form = new FormData();
    const bytes = fs.readFileSync(audioPath);
    const blob = new Blob([bytes]);
    form.append("file", blob, path.basename(audioPath));
    form.append("language", env.VOICE_TRANSCRIBE_LANGUAGE || "es");

    const response = await fetch(`${url}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`voice_transcriber ${response.status}: ${detail.slice(0, 300)}`);
    }
    const json = await response.json();
    if (!json?.text) return null;
    return {
      text: String(json.text).trim(),
      engine: `${json.engine || "voice_transcriber"}:${json.model || "unknown"}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function transcribeSlackAudioFiles({ agent, event, token, repoRoot, env = process.env }) {
  if (!asBool(env.VOICE_TRANSCRIPTION_ENABLED, true)) {
    return { ok: true, transcripts: [], notices: ["Transcripcion de voz desactivada por VOICE_TRANSCRIPTION_ENABLED."] };
  }

  const files = Array.isArray(event.files) ? event.files.filter(isAudioFile) : [];
  if (files.length === 0) return { ok: true, transcripts: [], notices: [] };
  if (!token) throw new Error("Falta SLACK_BOT_TOKEN para descargar audio de Slack.");

  const maxBytes = Number(env.VOICE_AUDIO_MAX_BYTES || DEFAULT_MAX_BYTES);
  const baseDir = path.join(repoRoot, ".tmp", "voice", safeName(agent.id), safeName(event.ts || Date.now()));
  fs.mkdirSync(baseDir, { recursive: true });

  const transcripts = [];
  const notices = [];

  for (const file of files) {
    const name = safeName(file.name || file.title || `${file.id || "audio"}.audio`);
    const ext = path.extname(name) || `.${safeName(file.filetype || "audio")}`;
    const audioPath = path.join(baseDir, `${safeName(file.id || name)}${ext}`);
    await downloadSlackFile(file, token, audioPath, maxBytes);

    let text = null;
    let engine = "";
    const attempts = [
      ["voice_transcriber", transcribeWithVoiceTranscriber],
      ["whisper.cpp", transcribeWithWhisperCpp],
      ["faster-whisper", transcribeWithFasterWhisper],
      ["openai-whisper-local", transcribeWithOpenAIWhisperCli],
    ];

    const errors = [];
    for (const [label, fn] of attempts) {
      try {
        const result = await fn(audioPath, baseDir, env);
        if (typeof result === "string") {
          text = result;
          engine = label;
        } else if (result?.text) {
          text = result.text;
          engine = result.engine || label;
        }
        if (text) {
          break;
        }
      } catch (error) {
        errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!text) {
      const detail = errors.length ? ` Detalle: ${errors.join(" | ")}` : "";
      notices.push(
        `Recibi un audio (${name}), pero no encontre un motor gratuito de transcripcion. Inicia voice_transcriber, o instala whisper.cpp/faster-whisper/whisper CLI.${detail}`,
      );
      continue;
    }

    transcripts.push({
      fileId: file.id || "",
      name,
      engine,
      text,
      path: audioPath,
    });
  }

  return { ok: true, transcripts, notices };
}

export function formatTranscriptsForPrompt(transcripts = []) {
  return transcripts
    .map((item, index) => {
      const header = `[Audio transcrito de Slack ${index + 1}: ${item.name} | motor local: ${item.engine}]`;
      return `${header}\n${item.text}`;
    })
    .join("\n\n");
}

