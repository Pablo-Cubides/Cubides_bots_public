import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const imageRoot = path.join(repoRoot, "logs", "runtime", "slack-images");
const socioImageRoot = path.join(repoRoot, "business_agent", "data", "tmp", "slack-images");
fs.mkdirSync(imageRoot, { recursive: true });
fs.mkdirSync(socioImageRoot, { recursive: true });

function safeName(value = "") {
  return String(value || "image")
    .replace(/[^a-z0-9_.-]/gi, "-")
    .slice(0, 120);
}

function isImageFile(file = {}) {
  const mime = String(file.mimetype || "");
  const type = String(file.filetype || "");
  const name = String(file.name || file.title || "");
  return mime.startsWith("image/") || /^(png|jpe?g|webp|gif|bmp)$/i.test(type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
}

async function downloadSlackFile(file, token, outputPath, maxBytes) {
  const url = file.url_private_download || file.url_private;
  if (!url) throw new Error("La imagen de Slack no trae url_private_download.");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Slack rechazo descarga de imagen (${response.status}). Revisa files:read y reinstala la app.`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(`Imagen demasiado grande (${arrayBuffer.byteLength} bytes, max ${maxBytes}).`);
  }
  const bytes = Buffer.from(arrayBuffer);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  return bytes.length;
}

export async function collectSlackImages({ agent, event, token, env = {} }) {
  const files = Array.isArray(event.files) ? event.files.filter(isImageFile) : [];
  if (files.length === 0) return { ok: true, images: [], notices: [] };

  const maxBytes = Number(env.VISION_IMAGE_MAX_BYTES || 10 * 1024 * 1024);
  const date = new Date().toISOString().slice(0, 10);
  const baseRoot = agent.id === "socio" ? socioImageRoot : imageRoot;
  const dir = path.join(baseRoot, safeName(agent.id), date);
  const images = [];
  const notices = [];

  for (const file of files.slice(0, 5)) {
    try {
      const name = safeName(file.name || file.title || `${file.id || "image"}.${file.filetype || "img"}`);
      const ext = path.extname(name) || `.${safeName(file.filetype || "png")}`;
      const imagePath = path.join(dir, `${safeName(file.id || path.basename(name, ext))}${ext}`);
      const bytes = await downloadSlackFile(file, token, imagePath, maxBytes);
      images.push({
        id: file.id || "",
        name,
        path: imagePath,
        runtimePath:
          agent.id === "coach"
            ? imagePath.replace(repoRoot, "/home/claude/workspace").replace(/\\/g, "/")
            : agent.id === "socio"
              ? imagePath.replace(path.join(repoRoot, "business_agent", "data"), "/app/data").replace(/\\/g, "/")
              : imagePath,
        mime: file.mimetype || "",
        filetype: file.filetype || "",
        size: bytes,
        width: file.original_w || file.thumb_1024_w || file.thumb_960_w || null,
        height: file.original_h || file.thumb_1024_h || file.thumb_960_h || null,
      });
    } catch (error) {
      notices.push(`No pude descargar una imagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: notices.length === 0, images, notices };
}

export function formatImagesForPrompt(images = [], agentId = "") {
  if (!images.length) return "";
  const lines = images.map((image, index) => {
    const dims = image.width && image.height ? `${image.width}x${image.height}` : "dimensiones no reportadas";
    const agentPath = image.runtimePath || image.path;
    const geminiReference = agentId === "socio" && agentPath ? ` | referencia Gemini CLI: @${agentPath}` : "";
    return `Imagen ${index + 1}: ${image.name} | ${image.mime || image.filetype || "image"} | ${dims} | archivo accesible para el agente: ${agentPath}${geminiReference}`;
  });
  const shared = [
    "El usuario adjunto imagen(es) en Slack. Los modelos actuales soportan vision, pero si tu runtime no puede abrir imagen directamente, usa la ruta local o pide una descripcion puntual.",
    "No inventes contenido visual si no puedes inspeccionarlo.",
  ];
  if (agentId === "socio") {
    shared.push(
      "Si eres Gemini CLI/Socio, usa la referencia con @archivo exactamente como aparece arriba para inspeccionar la imagen local antes de responder.",
      "No digas que falta un adaptador de vision si existe una referencia @/app/data/...; primero intenta razonar sobre esa imagen.",
    );
  } else {
    shared.push("Si no puedes interpretar la imagen local, di claramente que falta un adaptador de vision local.");
  }
  return [...shared, ...lines].join("\n");
}


