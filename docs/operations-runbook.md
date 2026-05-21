# Runbook Operativo

Última actualización: 2026-05-16

Este runbook reúne los comandos habituales para arrancar, validar, diagnosticar y recuperar el stack multi-agente.

## 1. Arranque Diario

Desde `D:\Agents`:

```powershell
.\scripts\start-command-center.ps1
```

Si necesitas levantar servicios por separado:

```powershell
.\scripts\start-academic.ps1
.\scripts\start-personal.ps1 -NoAttach
.\scripts\start-business.ps1 -NoBuild
.\scripts\start-voice-transcriber.ps1
.\scripts\start-slack-bridge.ps1 -Detached
.\scripts\start-dashboard.ps1
```

## 2. URLs Locales

| Servicio | URL |
| --- | --- |
| Dashboard | `http://127.0.0.1:3100` |
| Colega / OpenClaw | `http://127.0.0.1:18789` |
| Socio API/UI | `http://127.0.0.1:8003` |
| Socio Heavy | `http://127.0.0.1:6080` |
| Voice Transcriber | `http://127.0.0.1:8011/health` |
| SearXNG | `http://127.0.0.1:8088` |

## 3. Validación Rápida

```powershell
docker compose ps
docker compose config --quiet
.\scripts\validate-personal.ps1
.\scripts\validate-notion.ps1 -Agent all -Search
node .\agent_tools\google_workspace.mjs --agent colega --action verify
node .\agent_tools\google_workspace.mjs --agent coach --action verify
node .\agent_tools\google_workspace.mjs --agent socio --action verify
node .\agent_tools\vercel_observer.mjs --action verify
curl http://127.0.0.1:8088/search?q=test
```

## 4. Validación De Modelos

```powershell
.\scripts\discover-model-access.ps1 -RunProbes
```

Lectura esperada:

- Colega: acceso OpenAI Codex OAuth.
- Coach: Claude OAuth (`CLAUDE_CODE_OAUTH_TOKEN`) y sin `ANTHROPIC_API_KEY`.
- Socio: Gemini CLI con `gemini-2.5-flash` para estándar y `gemini-2.5-pro` para profundo.

Nota de migración: Socio mantiene `SOCIO_AGENT_RUNTIME=gemini-cli` en producción. El punto de cambio futuro hacia Antigravity CLI está documentado en `docs/socio-runtime-migration.md` y centralizado para herramientas host en `agent_tools/socio_runtime.mjs`.

## 5. Slack

Iniciar:

```powershell
.\scripts\start-slack-bridge.ps1 -Detached
```

Detener:

```powershell
.\scripts\start-slack-bridge.ps1 -Stop
```

Ver estado:

```powershell
Get-Process node -ErrorAction SilentlyContinue
Get-Content .\.tmp\slack-bridge.pid -ErrorAction SilentlyContinue
```

Problemas frecuentes:

| Síntoma | Acción |
| --- | --- |
| No responde Coach/Socio | Reiniciar bridge y revisar `SLACK_APP_TOKEN`/`SLACK_BOT_TOKEN`. |
| Colega responde en historial raro | Revisar configuración nativa OpenClaw y DM policy. |
| Colega falla con `Unknown memory embedding provider` o `Local embeddings unavailable` | Verificar `docker exec colega openclaw config get agents.defaults.memorySearch`, reconstruir Colega si falta `node-llama-cpp`, y validar con `docker exec colega openclaw memory status --deep`. |
| Audio falla | Validar `voice_transcriber` y scopes `files:read`. |
| Colega falla buscando web | Validar SearXNG: `docker compose --profile openclaw up -d searxng colega` y `curl http://127.0.0.1:8088/search?q=test`. |
| `missing_scope` | Agregar scope en Slack, reinstalar app y regenerar runtime env. |

## 6. Rutinas

Horarios estándar:

- Mañana: `08:05`
- Noche: `21:30`
- Domingo: `17:00`

Arrancar orquestador:

```powershell
.\scripts\start-routine-orchestrator.ps1 -Detached
```

Probar manualmente:

```powershell
.\scripts\test-agent-routines.ps1 -Agent coach -Routine daily_improvement_plan
.\scripts\test-agent-routines.ps1 -Agent socio -Routine nightly_review
.\scripts\test-agent-routines.ps1 -Agent colega -Routine sunday_roundtable
```

Colega nativo:

```powershell
.\scripts\setup-colega-openclaw-cron.ps1
.\scripts\setup-colega-openclaw-cron.ps1 -Apply
docker exec colega openclaw cron list
docker exec colega openclaw cron status
```

## 7. Deep Research

Iniciar runner:

```powershell
.\scripts\start-deep-research-runner.ps1 -Detached
```

Detener:

```powershell
.\scripts\start-deep-research-runner.ps1 -Stop
```

Ejecutar una pasada:

```powershell
.\scripts\start-deep-research-runner.ps1 -Once
```

Logs:

```powershell
Get-Content .\logs\deep-research-runner.log -Tail 120
```

## 8. Notion

Validar token y mapa:

```powershell
.\scripts\validate-notion.ps1 -Agent all -Search
.\scripts\show-notion-map.ps1
```

Listar recursos visibles:

```powershell
.\scripts\list-notion-resources.ps1 -Agent coach -Type database -Limit 100
.\scripts\list-notion-resources.ps1 -Agent socio -Type page -Limit 100
```

Usar herramienta segura:

```powershell
node .\agent_tools\notion_tool.mjs map --agent coach
node .\agent_tools\notion_tool.mjs search --agent coach --query "gym"
```

## 9. Google Workspace

Validar:

```powershell
node .\agent_tools\google_workspace.mjs --agent colega --action verify
node .\agent_tools\google_workspace.mjs --agent coach --action verify
node .\agent_tools\google_workspace.mjs --agent socio --action verify
```

Crear/verificar estructura solo después de que `verify` pase:

```powershell
node .\agent_tools\google_workspace.mjs --agent colega --action ensure
node .\agent_tools\google_workspace.mjs --agent coach --action ensure
node .\agent_tools\google_workspace.mjs --agent socio --action ensure
```

Si aparece `insufficient authentication scopes` o `invalid_grant`, reautorizar el agente con:

```powershell
.\scripts\google-oauth-agent.ps1 -Agent colega -ClientSecretPath "RUTA_AL_JSON"
```

## 10. Vercel

Socio tiene acceso observer mediante `VERCEL_TOKEN`. Es suficiente para revisar proyectos, dominios, deployments, eventos y errores; no modifica Vercel.

```powershell
node .\agent_tools\vercel_observer.mjs --action verify
node .\agent_tools\vercel_observer.mjs --action list-projects
node .\agent_tools\vercel_observer.mjs --action inspect-project --project project-alpha
node .\agent_tools\vercel_observer.mjs --action list-deployments --project Project Gamma-ia
node .\agent_tools\vercel_observer.mjs --action project-domains --project Project Beta
```

La herramienta no hace deploys, rollbacks ni cambios de dominio.

## 11. Logs Principales

Docker:

```powershell
docker logs --tail 120 colega
docker logs --tail 120 personal
docker logs --tail 120 business_agent
docker logs --tail 120 business_agent_daemon
docker logs --tail 80 voice_transcriber
```

Host:

```powershell
Get-Content .\logs\slack-bridge.log -Tail 120
Get-Content .\logs\routine-orchestrator.log -Tail 120
Get-Content .\logs\deep-research-runner.log -Tail 120
Get-Content .\logs\command-center.log -Tail 120
```

## 12. Build Y Validación Técnica

Dashboard:

```powershell
cd D:\Agents\dashboard
D:\Programas\node.exe D:\Programas\node_modules\npm\bin\npm-cli.js run typecheck
D:\Programas\node.exe D:\Programas\node_modules\npm\bin\npm-cli.js run build
D:\Programas\node.exe D:\Programas\node_modules\npm\bin\npm-cli.js audit --omit=dev --audit-level=moderate
```

Compose:

```powershell
cd D:\Agents
docker compose config --quiet
docker compose --profile heavy config --quiet
```

Python syntax:

```powershell
@'
import ast
from pathlib import Path
for file in [Path('business_agent/app/heartbeat.py'), Path('business_agent/app/main.py')]:
    ast.parse(file.read_text(encoding='utf-8'), filename=str(file))
    print(f'{file}: syntax ok')
'@ | C:\Users\pacub\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -
```

## 13. Recuperación Rápida

| Problema | Recuperación |
| --- | --- |
| Dashboard no abre | `.\scripts\start-dashboard.ps1`; revisar `logs/command-center.log`. |
| Docker Desktop apagado | Abrir Docker Desktop y esperar que `docker compose ps` responda. |
| Slack Bridge caído | `.\scripts\start-slack-bridge.ps1 -Detached`. |
| Coach no autentica | `.\scripts\validate-personal.ps1`; revisar `CLAUDE_CODE_OAUTH_TOKEN`. |
| Socio repite memoria vieja | Revisar `business_agent/data/memory/current_state.md` y `docs/runtime-data-boundaries.md`. |
| Socio pide `VERCEL_TOKEN` aunque existe | Ejecutar `node agent_tools\vercel_observer.mjs --action verify`; si OK, reiniciar `business_agent_daemon` para recargar contexto. |
| Colega olvida Slack | Ejecutar `.\scripts\update-colega-native-memory.ps1`. |
| Audio no transcribe | `.\scripts\start-voice-transcriber.ps1` y reiniciar Slack Bridge. |
| Vercel no responde | Verificar `VERCEL_TOKEN` y `node agent_tools\vercel_observer.mjs --action verify`. |

## 14. Antes De Hacer Push

```powershell
git status --short
git diff --stat
git check-ignore -v .age/keys.txt
git check-ignore -v secrets/runtime/personal.env
```

No subir:

- `.env`
- `.age/keys.txt`
- `secrets/runtime/*.env`
- `logs/`
- `.tmp/`
- `business_agent/data/tmp/`
- artefactos generados por agentes que no hayan sido aprobados.

