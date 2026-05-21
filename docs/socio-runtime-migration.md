# Socio Runtime Migration: Gemini CLI -> Antigravity CLI

Última actualización: 2026-05-20

## Resumen

Socio funciona hoy sobre Gemini CLI dentro de `business_agent_daemon`. Google anunció la transición de Gemini CLI hacia Antigravity CLI para flujos agentic. No se cambia producción todavía: esta guía documenta los puntos de acoplamiento, la abstracción ligera que ya existe y el checklist para migrar cuando haya feedback suficiente de la comunidad.

Decisión actual:

- Producción: `SOCIO_AGENT_RUNTIME=gemini-cli`.
- Antigravity CLI: solo pruebas paralelas hasta validar equivalencia real.
- Antigravity IDE/Desktop: no es dependencia del stack por ahora.

## Qué Es Y Qué No Es

El `antigravity-swarm` actual de Socio no es Google Antigravity. Es una skill externa/pasiva registrada en Gemini CLI:

- Dockerfiles clonan `wjgoarxiv/antigravity-swarm`.
- `business_agent/app/heartbeat.py` crea el symlink en `~/.gemini/skills/antigravity-swarm`.
- La skill puede ser descubierta por Gemini CLI, pero no reemplaza el runtime.

Google Antigravity/Antigravity CLI es otro producto/runtime. Migrar a ese runtime requiere pruebas de comandos, autenticación, sandbox, archivos locales, imágenes y aprobación de tools.

## Puntos De Acoplamiento Actuales

| Área | Archivo | Acoplamiento |
| --- | --- | --- |
| Instalación Lite | `business_agent/Dockerfile` | Instala `@google/gemini-cli` y prepara `ripgrep`. |
| Instalación Heavy | `business_agent/Dockerfile.heavy` | Instala `@google/gemini-cli` para VNC/GUI. |
| Daemon Socio | `business_agent/app/heartbeat.py` | Usa `GEMINI_CLI_SCRIPT` para ejecutar el modelo en rutinas y tareas. |
| Slack normal | `slack_bridge/src/index.js` | Usa `agent_tools/socio_runtime.mjs` para invocar Socio. |
| Rutinas host | `agent_tools/routine_orchestrator.mjs` | Usa `agent_tools/socio_runtime.mjs` si el modo no es daemon. |
| Deep research | `agent_tools/deep_research_runner.mjs` | Usa `agent_tools/socio_runtime.mjs` para jobs de Socio. |
| Descubrimiento | `scripts/discover-model-access.ps1` | Lista/probe modelos `gemini-cli`. |
| Docs | `docs/current-state.md`, `docs/operations-runbook.md` | Describen Socio como Gemini CLI. |

## Abstracción Ligera

La abstracción vive en:

```text
agent_tools/socio_runtime.mjs
```

Variables principales:

```env
SOCIO_AGENT_RUNTIME=gemini-cli
SOCIO_DAEMON_CONTAINER=business_agent_daemon
SOCIO_AGENT_WORKDIR=/app/data/tasks
SOCIO_AGENT_NODE=node
SOCIO_GEMINI_CLI_SCRIPT=/usr/lib/node_modules/@google/gemini-cli/bundle/gemini.js
```

Por ahora `SOCIO_AGENT_RUNTIME` solo acepta `gemini-cli`. Si se cambia a otro valor, la herramienta falla explícitamente para evitar una migración silenciosa.

Dónde se cambia el runtime:

1. `.env` / `.env.example`: `SOCIO_AGENT_RUNTIME`.
2. `agent_tools/socio_runtime.mjs`: implementar el nuevo constructor de argumentos.
3. Dockerfiles de Socio: instalar Antigravity CLI cuando se valide.
4. `business_agent/app/heartbeat.py`: reemplazar o compatibilizar `GEMINI_CLI_SCRIPT` con la nueva CLI.

## Checklist De Migración

### 1. Esperar Feedback Inicial

Ventana sugerida: revisar comunidad y issues entre el 27 y 31 de mayo de 2026.

Confirmar:

- Comando headless equivalente a `--prompt`.
- Modo de aprobación equivalente a `--approval-mode yolo|plan`.
- Soporte de workspace local y `--skip-trust` o equivalente.
- Soporte de referencias a archivos locales, especialmente imágenes con `@/path`.
- Manejo de sesiones y memoria.
- Compatibilidad con OAuth/Pro/Ultra o necesidad de API key.
- Cambios de costo/cuota.

### 2. Prueba En Paralelo

No tocar producción. Crear una prueba manual que ejecute Antigravity CLI contra tareas pequeñas:

```powershell
cd D:\Agents
# ejemplo futuro, ajustar al comando real cuando exista en el host/contenedor
docker exec -w /app/data/tasks business_agent_daemon antigravity --help
```

Casos mínimos:

- Responder texto corto.
- Leer archivo local.
- Usar imagen local.
- Ejecutar herramienta de solo lectura: `node /opt/agent_tools/vercel_observer.mjs --action verify`.
- Crear un Doc con `google_workspace.mjs` en modo controlado.
- Enviar mensaje normal por Slack.
- Rutina de mañana.
- Deep research pequeño.

### 3. Implementación Controlada

Cuando las pruebas pasen:

1. Instalar Antigravity CLI en Dockerfile Lite y Heavy.
2. Extender `agent_tools/socio_runtime.mjs` con `SOCIO_AGENT_RUNTIME=antigravity-cli`.
3. Extender `business_agent/app/heartbeat.py` para seleccionar runtime.
4. Añadir probes a `scripts/discover-model-access.ps1`.
5. Actualizar `docs/current-state.md` y `docs/operations-runbook.md`.

### 4. Criterios Para Cambiar Producción

No migrar si falla cualquiera de estos puntos:

- Slack normal tarda más o pierde contexto.
- Rutinas no llegan.
- Deep research no crea Docs/enlaces.
- No puede leer imágenes locales.
- Requiere permisos más amplios sin beneficio claro.
- Se pierde autonomía controlada de Socio.

Migrar si:

- Antigravity CLI mantiene o mejora estabilidad frente a 429.
- Mantiene acceso a modelos estables de Google.
- Respeta archivos locales y herramientas `/opt/agent_tools`.
- Permite auditar logs sin imprimir secretos.

## Rollback

Rollback esperado:

```env
SOCIO_AGENT_RUNTIME=gemini-cli
SOCIO_GEMINI_CLI_SCRIPT=/usr/lib/node_modules/@google/gemini-cli/bundle/gemini.js
```

Luego:

```powershell
cd D:\Agents
.\scripts\start-business.ps1 -NoBuild
.\scripts\start-slack-bridge.ps1 -Detached
.\scripts\start-routine-orchestrator.ps1 -Detached
.\scripts\start-deep-research-runner.ps1 -Detached
```

## Próxima Revisión

Revisar estado de Antigravity CLI y reportes de comunidad antes del 31 de mayo de 2026. Si ya hay estabilidad, preparar una rama experimental para Socio.

