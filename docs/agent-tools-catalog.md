# Catálogo De Herramientas Locales

Última actualización: 2026-05-16

Las herramientas de `agent_tools/` son utilidades locales compartidas. Deben usarse desde scripts, Slack Bridge, rutinas o agentes cuando aporten estructura y eviten improvisar comandos.

## Regla De Prioridad

Usar primero la integración nativa del runtime de cada agente cuando exista y sea estable:

- Colega: OpenClaw nativo, plugins y MCP registry de OpenClaw.
- Coach: Claude Code, MCP/herramientas configuradas para Claude Code y memoria propia.
- Socio: Gemini CLI, daemon y herramientas montadas en `/opt/agent_tools` solo cuando Gemini no tenga una integración nativa equivalente.

`agent_tools/` es la capa compartida para fallback, verificación, compatibilidad entre agentes y operaciones que aún no tienen integración nativa madura. No debe reemplazar una integración nativa sin una razón explícita.

## Reglas Generales

- No imprimir secretos.
- No aceptar comandos arbitrarios del usuario.
- Preferir acciones read-only por defecto.
- Escribir en Notion/Drive/Calendar solo cuando la intención esté clara.
- Guardar artefactos temporales fuera de memoria curada.

## Herramientas

| Herramienta | Estado | Uso |
| --- | --- | --- |
| `active_task_ledger.mjs` | Activa | Ledgers temporales para gym, comida, gastos e interacciones. |
| `academic_delivery.mjs` | Activa | Flujo académico de Colega: documento/resumen/correo. |
| `colega_native_memory_bridge.mjs` | Activa | Resume sesiones Slack nativas de OpenClaw hacia memoria puente. |
| `deep_research_runner.mjs` | Activa | Runner asíncrono de investigación profunda. |
| `google_workspace.mjs` | Activa | Drive, Docs, Slides y Calendar por OAuth. |
| `life_wiki.mjs` | Activa | Wiki situacional de Coach para patrones, vivencias y experimentos. |
| `notion_tool.mjs` | Activa | Lectura/escritura segura en Notion usando aliases. |
| `notion_map.mjs` | Activa | Lectura del mapa `config/notion-map.json`. |
| `notion_verify.mjs` | Activa | Validación de tokens y recursos visibles. |
| `notion_list_resources.mjs` | Activa | Enumerar páginas/bases visibles. |
| `routine_orchestrator.mjs` | Activa | Rutinas conversacionales de Coach/Socio y fallback. |
| `send_agent_mail.mjs` | Activa | Enviar correo desde Gmail del agente. |
| `slack_memory.mjs` | Activa | Memoria local de conversaciones Slack. |
| `vercel_observer.mjs` | Activa | Observación tipo observer de Vercel para Socio: proyectos, dominios, deployments, eventos y errores. |
| `vision_gateway.mjs` | Experimental | Preparar imágenes para modelos con visión. |
| `voice_gateway.mjs` | Activa | Transcripción local de audios Slack. |

## Comandos De Referencia

Notion:

```powershell
node .\agent_tools\notion_tool.mjs map --agent coach
node .\agent_tools\notion_tool.mjs search --agent coach --query "gym"
```

Google:

```powershell
node .\agent_tools\google_workspace.mjs --agent socio --action verify
node .\agent_tools\google_workspace.mjs --agent colega --action verify
```

Vercel:

```powershell
node .\agent_tools\vercel_observer.mjs --action verify
node .\agent_tools\vercel_observer.mjs --action list-projects
```

Colega memory:

```powershell
node .\agent_tools\colega_native_memory_bridge.mjs --days 10
```

Deep research:

```powershell
node .\agent_tools\deep_research_runner.mjs --help
```

Life Wiki de Coach:

```powershell
node .\agent_tools\life_wiki.mjs status
node .\agent_tools\life_wiki.mjs ingest --domain relaciones --title "Titulo" --text "Resumen fiel" --dry-run
node .\agent_tools\life_wiki.mjs search --query "confianza"
```

Correo:

```powershell
node .\agent_tools\send_agent_mail.mjs --help
```

## Cuándo Crear Una Nueva Herramienta

Crear una herramienta nueva cuando:

- El agente repite una operación con alto riesgo de equivocarse.
- Hay que normalizar datos antes de escribir en Notion/Drive.
- Se necesita una allowlist de acciones.
- El resultado debe ser auditado o reutilizado por varios agentes.

No crear una herramienta nueva cuando:

- Es una acción única y manual.
- El runtime nativo ya lo hace mejor.
- La herramienta duplicaría una API existente sin agregar seguridad ni estructura.


