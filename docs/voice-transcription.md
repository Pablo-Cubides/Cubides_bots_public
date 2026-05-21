# Transcripcion De Audios Slack

## Decision Arquitectonica

- Colega usa Slack nativo de OpenClaw. Por tanto, su audio debe pasar por el pipeline oficial de OpenClaw, no por el Slack Bridge.
- Coach y Socio usan `slack_bridge/`. Sus audios pasan por el gateway local `agent_tools/voice_gateway.mjs`.
- No se instala Whisper en el celular. El celular solo sube el audio a Slack; la transcripcion ocurre en el PC/stack local.

## Colega: OpenClaw Nativo

OpenClaw 2026.5.x soporta audio/voice notes nativamente:

- descarga adjuntos desde Slack;
- aplica limite de bytes;
- prueba modelos/proveedores/CLI disponibles;
- reemplaza el cuerpo del mensaje con un bloque `[Audio]`;
- expone la transcripcion como `{{Transcript}}`.

Configuracion aplicada en el contenedor de Colega:

```json
{
  "tools": {
    "media": {
      "audio": {
        "enabled": true,
        "maxBytes": 20971520,
        "maxChars": 6000,
        "echoTranscript": true
      }
    }
  }
}
```

Checklist operativo para Colega:

1. En la Slack App de Colega agregar/verificar scopes:

```text
users:read
channels:read
groups:read
im:read
mpim:read
files:read
files:write
```

2. Reinstalar la Slack App de Colega en el workspace.
3. Regenerar secretos si Slack emite un token nuevo:

```powershell
cd D:\Agents
.\scripts\add-agent-slack-secrets.ps1 -Agent colega
.\scripts\start-academic.ps1
```

4. Probar un audio por Slack a Colega.

Notas:

- `openclaw channels capabilities --channel slack` debe mostrar `files:read` y `files:write` dentro de `Bot scopes`.
- El contenedor de Colega no trae ahora mismo `whisper-cli`, `whisper`, `sherpa-onnx-offline` ni `gemini` en PATH. OpenClaw puede usar un proveedor STT si existe auth/config, o un CLI local si se instala dentro del contenedor.
- Decisión actual: no usar el puente local para Colega. Si OpenClaw nativo falla, se corrige la configuración nativa o el motor/proveedor configurado en OpenClaw. `COLEGA_NATIVE_AUDIO_BRIDGE=true` queda solo como prueba temporal explícita, no como fallback operativo por defecto.

## Coach Y Socio: Slack Bridge

El Slack Bridge soporta transcripcion local de audios para Coach y Socio.

Para Colega en modo nativo no se abre un segundo Socket Mode client, porque podria competir con OpenClaw por los eventos de Slack. Si alguna vez se necesita probar Colega por bridge, cambiar temporalmente `COLEGA_SLACK_MODE=bridge`.

## Comportamiento

- Si llega un archivo de audio por Slack, el bridge lo descarga con `SLACK_BOT_TOKEN`.
- Intenta transcribirlo con motores locales gratuitos, en este orden:
  1. `voice_transcriber` compartido (`http://127.0.0.1:8011`)
  2. `whisper.cpp` (`WHISPER_CPP_BIN` + `WHISPER_CPP_MODEL`)
  3. `faster-whisper` local
  4. `whisper` CLI local
- La transcripcion se inyecta al agente como:

```text
[Audio transcrito de Slack: archivo.m4a | motor local: whisper.cpp]
...
```

- No usa OpenAI, Google, Azure ni ElevenLabs para transcribir. Si no hay servicio local o motor local instalado, responde por Slack indicando que falta el motor.
- Los audios temporales quedan en `.tmp/voice/`, carpeta gitignored.

## Scopes Slack Necesarios Para Coach/Socio

Agregar a cada Slack App que vaya a recibir audios:

```text
files:read
```

Luego reinstalar la app en Slack para que el token `xoxb-...` tome el nuevo permiso.

## Opcion Recomendada: voice_transcriber Compartido

Iniciar el servicio:

```powershell
cd D:\Agents
.\scripts\start-voice-transcriber.ps1
.\scripts\start-slack-bridge.ps1 -Stop
.\scripts\start-slack-bridge.ps1 -Detached
```

El servicio corre en:

```text
http://127.0.0.1:8011
```

Variables:

```env
VOICE_TRANSCRIBER_URL=http://127.0.0.1:8011
VOICE_TRANSCRIBER_MODEL=small
VOICE_TRANSCRIBER_DEVICE=cpu
VOICE_TRANSCRIBER_COMPUTE_TYPE=int8
VOICE_TRANSCRIBE_LANGUAGE=es
VOICE_AUDIO_MAX_BYTES=26214400
```

Notas:

- La primera vez descargara el modelo Whisper configurado dentro del volumen `voice_transcriber_cache`.
- `small` es el punto inicial recomendado para espanol. Si va muy lento, bajar a `base`; si falla calidad, subir a `medium`.
- El servicio es local y no usa APIs pagas.

## Opcion Alterna: whisper.cpp

Configurar estas variables en el entorno donde corre `start-slack-bridge.ps1`, o en `.env`:

```env
VOICE_TRANSCRIPTION_ENABLED=true
WHISPER_CPP_BIN=C:\tools\whisper.cpp\whisper-cli.exe
WHISPER_CPP_MODEL=C:\tools\whisper.cpp\models\ggml-small.bin
VOICE_TRANSCRIBE_LANGUAGE=auto
VOICE_AUDIO_MAX_BYTES=26214400
```

Notas:

- `ggml-small.bin` suele ser buen punto de partida para español.
- `VOICE_TRANSCRIBE_LANGUAGE=auto` permite audios en español o ingles. Si quieres forzar español usa `es`.
- No guardes modelos dentro del repo.

## Opcion Alterna: faster-whisper

Si ya tienes `faster-whisper` instalado localmente:

```env
FASTER_WHISPER_MODEL=small
VOICE_TRANSCRIBE_LANGUAGE=es
```

El bridge ejecuta `agent_tools/voice/transcribe_faster_whisper.py`.

## Opcion Alterna: whisper CLI

Si tienes instalado el paquete local de Whisper:

```env
WHISPER_BIN=whisper
LOCAL_WHISPER_MODEL=small
VOICE_TRANSCRIBE_LANGUAGE=Spanish
```

## Prueba Manual

1. Reinicia Slack Bridge:

```powershell
cd D:\Agents
.\scripts\start-slack-bridge.ps1 -Stop
.\scripts\start-slack-bridge.ps1 -Detached
```

2. Envia un audio corto a Coach o Socio por Slack.
3. Debe aparecer primero un mensaje tipo `Audio transcrito (...)`.
4. Luego el agente responde usando la transcripcion como mensaje normal.

Si aparece el aviso de que no hay motor local, la integracion Slack ya esta funcionando; falta instalar/configurar Whisper local o mover la transcripcion a un contenedor compartido.

## Arquitectura Actual

No instalamos Whisper tres veces. El stack ya incluye un servicio compartido:

```text
voice_transcriber
```

Flujo:

```text
Slack Bridge -> descarga audio -> voice_transcriber -> texto -> Coach/Socio
OpenClaw -> pipeline nativo -> CLI/proveedor STT -> Colega
```

Esto evita duplicar modelos, mantiene a cada agente liviano y permite controlar limites desde un solo lugar.

