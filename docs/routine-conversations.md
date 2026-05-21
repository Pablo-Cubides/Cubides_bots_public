# Rutinas Conversacionales Y Memoria

Las rutinas ya no son tareas secas escritas en archivos. Ahora se ejecutan como conversaciones por Slack y cada agente conserva memoria local de los intercambios.

## Flujo Actual

- **Colega**: objetivo operativo es OpenClaw nativo para Slack, cron, sesiones y memoria. Mientras se valida cada entrega, el orquestador host puede ejecutar pruebas manuales. Para instalar cron nativo, ejecutar `scripts/setup-colega-openclaw-cron.ps1 -Apply` y definir en `.env`:
  - `COLEGA_SLACK_MODE=native`
  - `COLEGA_ROUTINE_MODE=native`
- **Coach**: usa Claude Code con `CLAUDE.md`, `MEMORY.md` y `ROUTINES.md`; el orquestador local dispara mañana, noche y domingo.
- **Socio**: usa su propio `business_agent/app/heartbeat.py`; el daemon revisa rutinas programadas y también acepta ejecuciones forzadas.

## Horarios

Todos usan `America/Bogota`.

- Mañana: `08:05`
- Noche: `21:30`
- Domingo: `17:00`

El orquestador host-local corre con:

```powershell
cd D:\Agents
.\scripts\start-routine-orchestrator.ps1 -Detached
.\scripts\start-routine-orchestrator.ps1 -Stop
```

Prueba manual:

```powershell
.\scripts\test-agent-routines.ps1 -Agent coach -Routine daily_improvement_plan
.\scripts\test-agent-routines.ps1 -Agent socio -Routine nightly_review
.\scripts\test-agent-routines.ps1 -Agent colega -Routine sunday_roundtable
```

`-DryRun` muestra/genera el flujo sin publicar en Slack ni ejecutar el modelo.

## Memoria

La memoria conversacional local queda en:

```text
logs/runtime/agent-conversations/
logs/runtime/slack-routes/
```

Estos archivos no se versionan. El bridge guarda tanto mensajes entrantes como respuestas salientes, con timestamp, canal, hilo, agente, rutina y modelo cuando aplica.

Socio además conserva sus rutinas en:

```text
business_agent/data/memory/routines.md
business_agent/data/logs/routines.md
business_agent/data/.agent/routines/state.json
```

Colega usa memoria nativa de OpenClaw más un puente de auditoría/resumen:

```text
logs/runtime/colega-memory-bridge/
```

Actualizar manualmente:

```powershell
.\scripts\update-colega-native-memory.ps1
```

## Drive

Las rutinas ligeras no se guardan en Drive. Drive/Docs/Slides queda para investigaciones profundas, reportes amplios, planes extensos o presentaciones.

## Dashboard

El Centro de Comando muestra:

- estado del Slack Bridge;
- estado del Deep Research Runner;
- estado del Routine Orchestrator;
- estado preview/configurado del cron nativo de Colega;
- últimas rutinas ejecutadas y errores recientes.


