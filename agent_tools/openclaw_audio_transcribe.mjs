#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: openclaw_audio_transcribe.mjs <audio-path>");
}

async function health(baseUrl) {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`voice_transcriber health ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  console.error(`voice_transcriber ok (${json.engine || "faster-whisper"}:${json.model || "unknown"})`);
}

async function transcribe(audioPath) {
  const baseUrl = String(
    process.env.OPENCLAW_AUDIO_TRANSCRIBER_URL ||
      process.env.VOICE_TRANSCRIBER_URL ||
      "http://voice_transcriber:8011",
  ).replace(/\/+$/, "");

  if (!audioPath || audioPath === "--help" || audioPath === "-h") {
    usage();
    process.exit(audioPath ? 0 : 2);
  }

  if (audioPath === "--health") {
    await health(baseUrl);
    return;
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const stat = fs.statSync(audioPath);
  const maxBytes = Number(process.env.OPENCLAW_AUDIO_MAX_BYTES || process.env.VOICE_AUDIO_MAX_BYTES || 20 * 1024 * 1024);
  if (stat.size <= 0) throw new Error("Audio file is empty.");
  if (stat.size > maxBytes) throw new Error(`Audio file too large: ${stat.size} bytes.`);

  const bytes = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append("file", new Blob([bytes]), path.basename(audioPath));
  form.append("language", process.env.OPENCLAW_AUDIO_LANGUAGE || process.env.VOICE_TRANSCRIBE_LANGUAGE || "es");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENCLAW_AUDIO_TIMEOUT_MS || 240000));
  try {
    const response = await fetch(`${baseUrl}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`voice_transcriber ${response.status}: ${detail.slice(0, 400)}`);
    }
    const json = await response.json();
    const text = String(json?.text || "").trim();
    if (!text) throw new Error("voice_transcriber returned an empty transcript.");
    process.stdout.write(text);
  } finally {
    clearTimeout(timeout);
  }
}

transcribe(process.argv[2]).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

