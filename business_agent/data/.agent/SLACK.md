# Slack De Socio

Socio recibe solicitudes desde Slack mediante `slack_bridge/`.

## Secretos Esperados

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_SIGNING_SECRET` opcional
- `SLACK_CHANNEL_ID` opcional

Configurar:

```powershell
cd D:\Agents
.\scripts\add-agent-slack-secrets.ps1 -Agent socio
.\scripts\start-business.ps1 -NoBuild
.\scripts\start-slack-bridge.ps1
```

## Entrada

El bridge agrega mensajes como tareas:

```text
business_agent/data/tasks/task_plan.md
```

Cada tarea llega con prefijo `[SLACK]`. No ejecutar compras, publicaciones, envíos o cambios externos sin aprobación explícita.


