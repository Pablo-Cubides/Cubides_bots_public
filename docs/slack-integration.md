# Slack Para Agentes

Ultima actualizacion: 2026-05-06

La integracion usa Slack Socket Mode para no exponer puertos publicos ni configurar un Request URL. Slack recomienda Socket Mode para apps locales o detras de firewall: se usa `SLACK_APP_TOKEN` (`xapp-...`) para abrir el WebSocket y `SLACK_BOT_TOKEN` (`xoxb-...`) para operar como bot.

Referencia oficial: https://api.slack.com/apis/connections/socket

## Estrategia

- Crear una Slack App por agente: Colega, Coach y Socio.
- Cada app tiene su propio bot token y app-level token.
- Los secretos viven cifrados en el archivo del agente correspondiente.
- El bridge local `slack_bridge/` escucha menciones o mensajes directos y los convierte en bandejas locales.
- El bridge guarda memoria conversacional local en `logs/runtime/agent-conversations/` y rutas recientes en `logs/runtime/slack-routes/`. Esa memoria se reinyecta en respuestas posteriores para que los agentes conserven contexto reciente de Slack.

## Crear Cada App En Slack

Para cada agente:

1. Entra a https://api.slack.com/apps.
2. Crea una app nueva en tu workspace.
3. Activa Socket Mode.
4. Crea un App-Level Token con scope `connections:write`; Slack lo entrega como `xapp-...`.
5. En OAuth & Permissions agrega scopes de bot:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history`
   - `channels:read`
   - `files:read`
   - `files:write`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:read`
   - `im:write`
   - `mpim:read`
   - `users:read`
6. En Event Subscriptions agrega:
   - `app_mention`
   - `message.im`
7. Instala la app en el workspace.
8. Copia el Bot User OAuth Token `xoxb-...`.

## Guardar Secretos

```powershell
cd D:\Agents
.\scripts\add-agent-slack-secrets.ps1 -Agent colega
.\scripts\add-agent-slack-secrets.ps1 -Agent coach
.\scripts\add-agent-slack-secrets.ps1 -Agent socio
```

El script guarda:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_SIGNING_SECRET` opcional, reservado para HTTP futuro
- `SLACK_CHANNEL_ID` opcional

Para transcripcion de audios enviados por Slack, `files:read` es obligatorio. Para respuestas con audio o envio de archivos, `files:write` tambien. Ver `docs/voice-transcription.md`.

Despues regenera runtime env:

```powershell
.\scripts\start-academic.ps1
.\scripts\start-personal.ps1 -NoAttach
.\scripts\start-business.ps1 -NoBuild
```

## Levantar El Bridge

```powershell
cd D:\Agents

# Modo interactivo (Ctrl+C para detener):
.\scripts\start-slack-bridge.ps1

# Modo background (recomendado en uso normal):
.\scripts\start-slack-bridge.ps1 -Detached

# Detener:
.\scripts\start-slack-bridge.ps1 -Stop
```

La primera vez instala dependencias de `slack_bridge/`. Despues deja activo el proceso local.

**Auto-start integrado.** Los scripts `start-academic.ps1`, `start-business.ps1` y `start-personal.ps1` ya invocan `start-slack-bridge.ps1 -Detached` al final de su flujo. El llamado es idempotente — si el bridge ya esta vivo, sale sin hacer nada. Asi, arrancar cualquier agente garantiza que el bridge tambien este activo.

**Colega nativo.** Colega esta pensado para `COLEGA_SLACK_MODE=native`: OpenClaw maneja Slack, cron, sesiones y adjuntos. El bridge no debe abrir un segundo Socket Mode client con el mismo token salvo prueba temporal. El audio de Colega debe corregirse en OpenClaw nativo; `COLEGA_NATIVE_AUDIO_BRIDGE=true` queda solo como experimento temporal, no como fallback por defecto.

**PID y deteccion.** El modo `-Detached` escribe el PID del launcher en `.tmp/slack-bridge.pid`. El dashboard usa ese archivo para verificar si el bridge esta vivo y reflejarlo en el status del canal Slack de cada agente:

| Estado del bridge | Secretos | Status mostrado |
| --- | --- | --- |
| Vivo | OK | `active` |
| Caido | OK | `configured` |
| Vivo | Faltantes | `pendiente` |

**Coach + OAuth: sin `--max-budget-usd`.** El bridge invoca `claude -p` para Coach **sin** flag de budget. Coach usa `CLAUDE_CODE_OAUTH_TOKEN` (Pro/Max), donde el uso sale del cupo del plan (5 h rolling + cap semanal), no por token. `--max-budget-usd` cappea costo *estimado localmente* y aborta respuestas validas aunque no haya cobro real. El system prompt de Claude Code (~50K tokens cache) ya estima ~$0.05 antes de generar nada, por eso caps menores reventaban sistematicamente.

## Bandejas Por Agente

| Agente | Destino Slack |
| --- | --- |
| Colega | `academic_agent/profile/inbox/slack.md` |
| Coach | `personal_agent/inbox/slack.md` |
| Socio | `business_agent/data/tasks/task_plan.md` |

Socio entra directo como tarea porque ya tiene daemon. Colega y Coach reciben inbox local para revision/procesamiento por su runtime.

## Dashboard

El Centro de Comando marca Slack como:

- `pendiente`: no estan los secretos.
- `configurado`: estan en `secrets/*.enc.yaml`, pero falta regenerar runtime env.
- `activo`: estan en runtime env y el agente puede usarlos.

## Seguridad

- Nunca pegues tokens Slack en el dashboard.
- No versionar `secrets/runtime/*.env`.
- Usar una app por agente reduce blast radius.
- Rotar `xoxb` y `xapp` si se pegan por accidente en chats, logs o capturas.

