# Estado Actual Del Stack Multi-Agente

Última actualización: 2026-05-20

Este documento describe el estado real del proyecto después de la integración de Slack, Google Workspace, Notion, Vercel, voz, rutinas conversacionales, Centro de Comando y endurecimiento básico de seguridad.

## Resumen Operativo

| Componente | Contenedor/proceso | Estado esperado | Interfaz | Nota |
| --- | --- | --- | --- | --- |
| Colega | `colega` | `healthy` | `http://127.0.0.1:18789` | OpenClaw nativo con Slack, Codex OAuth, memoria puente y Google Workspace implementado por OAuth. |
| Coach | `personal` | `healthy` | CLI / Slack | Claude Code con OAuth Pro/Max, Notion, Google Workspace implementado por OAuth y ledgers. |
| Socio Lite | `business_agent` | `healthy` | `http://127.0.0.1:8003` | API local FastAPI protegida con token. |
| Socio Daemon | `business_agent_daemon` | `healthy` | logs Docker | `SOCIO_AGENT_RUNTIME=gemini-cli`; rutinas y tareas autónomas. |
| Socio Heavy | `business_agent_heavy` | bajo demanda | `http://127.0.0.1:6080` | GUI VNC para navegación visual. |
| Slack Bridge | proceso host | activo | Slack | Coach, Socio y audio de Colega si aplica. |
| Voice Transcriber | `voice_transcriber` | `healthy` | `http://127.0.0.1:8011/health` | Whisper local compartido. |
| SearXNG | `searxng` | `healthy` | `http://127.0.0.1:8088` | Búsqueda web local para Colega/OpenClaw. |
| Dashboard | proceso host | dev server | `http://127.0.0.1:3100` | Centro de Comando local-first. |

## Decisiones Vigentes

- El proyecto es personal/local. No se diseña como SaaS multiusuario.
- Los agentes conservan arquitecturas diferentes; la diversidad es intencional.
- Regla de integraciones: usar primero la integración nativa del runtime de cada agente cuando exista y sea estable. `agent_tools/` queda como fallback, verificador o puente temporal salvo instrucción explícita.
- Slack es el canal diario principal.
- Colega prioriza OpenClaw nativo para Slack, cron, sesiones y memoria.
- Coach y Socio usan Slack Bridge.
- Socio tiene autonomía explícita mediante `SOCIO_AUTO_APPROVE=true`.
- Socio sigue en Gemini CLI en producción. La migración futura a Antigravity CLI debe pasar por `agent_tools/socio_runtime.mjs` y el checklist de `docs/socio-runtime-migration.md`.
- Drive/Docs/Slides se reservan para investigaciones, reportes amplios, documentos y presentaciones; las rutinas ligeras quedan en memoria local/Notion cuando corresponde.
- Google Workspace depende de refresh tokens OAuth por agente. Si `node agent_tools\google_workspace.mjs --agent <agente> --action verify` devuelve `invalid_grant`, hay que reautorizar el agente con `scripts/google-oauth-agent.ps1` y regenerar `secrets/runtime/*.env`.
- Los agentes no deben editar el calendario personal de Primary User/Primary User; crean eventos solo en sus calendarios propios.

## Centro De Comando

Ubicación: `dashboard/`

Arranque:

```powershell
cd D:\Agents
.\scripts\start-dashboard.ps1
```

URL:

```text
http://127.0.0.1:3100
```

Funciones:

- Miniverso estilo AI town con Colega, Coach y Socio.
- Inspector técnico por agente: Docker, health, modelos, canales, logs y secretos presentes.
- Acciones allowlist: start, stop, restart, logs, validar, rutinas, modelos, Slack Bridge, runners y apertura de interfaces.
- Estados de Slack, Google, Notion, Vercel, correo y voz.
- Token en `sessionStorage`; no se guarda en código.

Seguridad:

- Usa `DASHBOARD_ADMIN_TOKEN`; si falta, usa `AGENT_ADMIN_TOKEN`.
- Si no existe ningún token, las acciones mutantes fallan cerrado con `503`.
- No acepta comandos arbitrarios del cliente.
- Next/PostCSS actualizados; `npm audit --omit=dev --audit-level=moderate` queda limpio.

## Colega

### Rol

Agente académico de Primary User. Objetivos: mejorar docencia, investigación, reputación académica, congresos, publicaciones, herramientas, análisis de datos, gestión ambiental, calidad/tratamiento de agua, IA y optimización.

### Runtime

- Contenedor: `colega`
- Runtime: OpenClaw
- UI/API: `http://127.0.0.1:18789`
- Volumen persistente: `misbots_openclaw_data`
- Perfil versionado: `academic_agent/profile/`
- Memoria puente: `logs/runtime/colega-memory-bridge/` montado read-only en OpenClaw.
- Memoria semántica nativa: `agents.defaults.memorySearch.provider=local`, `node-llama-cpp` instalado en la imagen y `sqlite-vec` activo para vectores locales.

### Modelos

| Fase | Modelo |
| --- | --- |
| `fast` | `openai-codex/gpt-5.4-mini` |
| `standard` | `openai-codex/gpt-5.4` |
| `deep` | `openai-codex/gpt-5.3-codex` |
| `fallback` | `openrouter/free` |

### Integraciones

- Slack nativo de OpenClaw.
- Gmail propio mediante app password.
- Google Drive/Docs/Slides/Calendar por OAuth.
- Notion: ruta objetivo mediante MCP nativo de OpenClaw. Mientras se valida, `agent_tools/notion_tool.mjs` queda como fallback y herramienta de verificación.
- Búsqueda web OpenClaw mediante SearXNG local (`SEARXNG_BASE_URL=http://searxng:8080`) y DuckDuckGo plugin como apoyo.
- Deep research y entrega académica mediante `agent_tools/academic_delivery.mjs`.
- Transcripción: OpenClaw nativo. El puente local hacia `voice_transcriber` queda apagado para Colega salvo prueba temporal explícita con `COLEGA_NATIVE_AUDIO_BRIDGE=true`.

### Comandos

```powershell
.\scripts\start-academic.ps1
.\scripts\switch-routing-profile.ps1 -Profile standard
.\scripts\update-colega-native-memory.ps1
docker exec colega openclaw models status
docker exec colega openclaw memory status --deep
docker exec colega openclaw plugins list
```

## Coach

### Rol

Agente personal de Primary User. Objetivos: salud, hábitos, relaciones, ingresos freelance/técnicos, mejora del stack y apoyo a otros agentes cuando corresponda.

### Runtime

- Contenedor: `personal`
- Runtime: Claude Code CLI
- Canal principal: Slack Bridge
- Memoria: `personal_agent/MEMORY.md`, `CLAUDE.md`, `ROUTINES.md`.
- Reglas: `personal_agent/.claude/settings.json` y hooks/rules.

### Modelos

| Fase | Modelo |
| --- | --- |
| `fast` | `haiku` |
| `standard` | `sonnet` |
| `deep` | `opus` |
| `planning` | `opusplan` |

### Integraciones

- Slack Bridge.
- Gmail propio.
- Google Drive/Docs/Slides/Calendar por OAuth.
- Notion con aliases para gym, comida, ayuno, hábitos, interacciones sociales y gastos.
- Ledgers temporales para tareas activas: gym, comida, gastos e interacciones, evitando depender de memoria conversacional larga.
- Life Wiki / Situation Wiki en `personal_agent/life_wiki/` para reportes narrativos, patrones, hipótesis y experimentos. Notion queda para datos estructurados.
- Regla: reportes narrativos no se guardan como páginas libres de Notion salvo orden explícita; van a Life Wiki.

### Comandos

```powershell
.\scripts\start-personal.ps1 -NoAttach
.\scripts\validate-personal.ps1
docker exec personal bash -lc "claude --version"
```

## Socio

### Rol

Agente de negocio de Primary User. Objetivos: crecer Project Alpha, Project Beta y Project Gamma; construir comunidad, estatus, ingresos, legalidad y tranquilidad operativa.

### Runtime

- API: `business_agent`, `http://127.0.0.1:8003`
- Daemon: `business_agent_daemon`
- GUI heavy: `business_agent_heavy`, `http://127.0.0.1:6080`
- Identidad/memoria: `business_agent/data/identity/`, `business_agent/data/memory/`, `business_agent/data/.agent/`.
- Estado autorizado actual: `business_agent/data/memory/current_state.md`.

### Modelos

| Fase | Modelo |
| --- | --- |
| `fast` | `gemini-2.5-flash-lite` |
| `standard` | `gemini-2.5-flash` |
| `deep` | `gemini-2.5-pro` |
| experimental/manual | `gemini-3-*` |

`GEMINI_MODEL` debe permanecer vacío salvo pruebas manuales para no sobrescribir la política por fases.

### Integraciones

- Slack Bridge.
- Gmail propio.
- Google Drive/Docs/Slides/Calendar por OAuth.
- Notion para negocio, apps y gastos.
- Vercel Observer mode:
  - `verify`
  - `list-projects`
  - `inspect-project`
  - `list-deployments`
  - `project-domains`
- Antigravity Swarm como skill pasiva disponible para Gemini; no es un planner activo por sí solo.
- Regla vigente: si `vercel_observer verify` funciona, Socio no debe pedir `VERCEL_TOKEN` ni consultar `.gemini/settings.json`.

### Comandos

```powershell
.\scripts\start-business.ps1 -NoBuild
node .\agent_tools\vercel_observer.mjs --action verify
node .\agent_tools\vercel_observer.mjs --action list-projects
docker logs --tail 120 business_agent_daemon
```

## Rutinas

Zona horaria: `America/Bogota`.

| Rutina | Hora | Canal | Objetivo |
| --- | --- | --- | --- |
| Mañana | `08:05` | Slack | Saludo, plan del día, prioridades y estado de mejoras aprobadas. |
| Noche | `21:30` | Slack | Cierre del día, memoria, bloqueos y preparación. |
| Domingo | `17:00` | Slack | Reunión semanal, oportunidades, prioridades y coordinación. |

Ejecución:

```powershell
.\scripts\start-routine-orchestrator.ps1 -Detached
.\scripts\test-agent-routines.ps1 -Agent coach -Routine daily_improvement_plan
.\scripts\test-agent-routines.ps1 -Agent socio -Routine nightly_review
.\scripts\setup-colega-openclaw-cron.ps1
```

Colega debe migrar completamente a cron nativo OpenClaw cuando la entrega Slack nativa quede validada.

## Notion

Estado: token OK y mapa operativo activo.

Regla vigente: si un runtime trae integración nativa suficiente, se configura esa primero. Para Colega/OpenClaw, la ruta preferida es registrar Notion como MCP en OpenClaw; para Coach y Socio se mantiene la herramienta compartida hasta que exista una integración nativa mejor en sus runtimes.

Archivo principal:

```text
config/notion-map.json
```

Aliases clave:

| Área | Alias |
| --- | --- |
| Tareas generales | `NOTION_TASKS_DATABASE_ID` |
| Gastos | `NOTION_EXPENSES_DATABASE_ID` |
| Gym | `COACH_GYM_DATABASE_ID` |
| Comida | `COACH_FOOD_DATABASE_ID` |
| Interacciones sociales | `COACH_SOCIAL_INTERACTIONS_DATABASE_ID` |
| Hábitos | `COACH_HABITS_DATABASE_ID` |
| Academia ambiental | `COLEGA_ENVIRONMENT_DATABASE_ID` |
| Apps/productos | `SOCIO_APPS_DATABASE_ID` |

Validación:

```powershell
.\scripts\validate-notion.ps1 -Agent all -Search
.\scripts\show-notion-map.ps1
node .\agent_tools\notion_tool.mjs map --agent coach
```

## Google Workspace Y Deep Research

Estado: implementación completa por OAuth para Drive, Docs, Slides y Calendar. Operativo cuando `verify` pasa para el agente correspondiente.

Herramientas:

```powershell
node .\agent_tools\google_workspace.mjs --agent colega --action verify
node .\agent_tools\google_workspace.mjs --agent coach --action verify
node .\agent_tools\google_workspace.mjs --agent socio --action verify
.\scripts\start-deep-research-runner.ps1 -Detached
```

Salida de deep research:

- Google Doc en el Drive propio del agente.
- Google Slides si la tarea pide presentación, clase, pitch o resumen visual.
- Respuesta final por Slack con resumen y enlaces.

## Voz E Imagen

Voz:

- Servicio local `voice_transcriber`.
- Coach y Socio usan `slack_bridge/` + `agent_tools/voice_gateway.mjs`.
- Colega usa OpenClaw nativo; el bridge no atiende audios de Colega salvo que se active explícitamente `COLEGA_NATIVE_AUDIO_BRIDGE=true`.

Imagen:

- `agent_tools/vision_gateway.mjs` existe para preparar análisis de imágenes.
- Coach ya puede leer imágenes locales por Claude Code.
- Socio recibe la ruta local y debe intentar usarla primero; si Gemini CLI no puede interpretarla, debe reportar falta de adaptador de visión local sin pedir URL web como única salida.
- Colega tiene visión nativa OpenClaw cuando el canal entrega imagen al modelo; el fallback del bridge prepara archivos.

## Seguridad Actual

- Secretos cifrados con SOPS + AGE.
- Runtime env gitignored.
- Puertos ligados a `127.0.0.1`.
- Dashboard fail-closed si falta token.
- Socio API usa `compare_digest`.
- Socio Lite y daemon: `read_only`, `tmpfs /tmp`, `cap_drop: ALL`, `no-new-privileges`.
- Socio Heavy: usuario no-root en Dockerfile, `no-new-privileges`, `cap_drop: ALL`, `tmpfs /tmp`.
- Colega mantiene `user: "0:0"` por compatibilidad OpenClaw pendiente de prueba formal non-root.

## Pendientes Relevantes

1. Validar Colega non-root o documentar exactamente por qué OpenClaw requiere root.
2. Validar en uso real si la configuración Slack nativa de Colega ya evita conversaciones perdidas en History.
3. Monitorear en uso real la memoria semántica local de OpenClaw y ajustar si aparecen falsos recuerdos o búsquedas pobres.
4. Conectar GitHub con flujo de PR revisado por humano.
5. Conectar Analytics/Search Console para Socio.
6. Mejorar telemetría real de costos/tokens/uso.
7. Definir política final para publicación externa en redes/social/marketing.


