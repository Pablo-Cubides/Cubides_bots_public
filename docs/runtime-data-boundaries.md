# Fronteras De Datos Runtime

Este stack es personal y local, pero los agentes escriben archivos durante su operación. Para evitar que lean basura vieja o que los commits mezclen estado runtime con configuración curada, se usa esta convención.

## Curated

Archivos revisados por el humano o diseñados como contexto estable del agente.

- `academic_agent/profile/`
- `personal_agent/*.md`
- `business_agent/data/identity/`
- `business_agent/data/.agent/`
- `business_agent/data/memory/current_state.md`
- `business_agent/data/memory/context.md`

## Runtime

Estado generado por procesos, rutinas, Slack, VNC, Gemini/OpenClaw/Claude, logs o transcripción. No debe entrar a git.

- `logs/`
- `.tmp/`
- `business_agent/data/logs/`
- `business_agent/data/tmp/`
- `business_agent/data/runtime/`
- `business_agent/data/.agent/state/`
- `business_agent/data/.gemini/`
- `business_agent/data/.cache/`
- `business_agent/data/.npm/`

## Artifacts

Piezas generadas por agentes que pueden ser útiles como borradores, pero no deben contaminar memoria estable hasta que el humano las apruebe.

- `business_agent/data/artifacts/`
- HTML/JS/TSX generados temporalmente por Socio
- imágenes descargadas desde Slack
- reportes exploratorios

## Regla Operativa

Si un agente produce algo útil, primero va a runtime/artifacts. Solo pasa a memoria curada cuando se resume y queda explícitamente aprobado o validado por una rutina de limpieza.

