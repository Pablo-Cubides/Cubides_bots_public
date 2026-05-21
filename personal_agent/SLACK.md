# Slack De Coach

Coach puede recibir solicitudes desde Slack usando el bridge local.

## Secretos Esperados

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_SIGNING_SECRET` opcional
- `SLACK_CHANNEL_ID` opcional

Configurar:

```powershell
cd D:\Agents
.\scripts\add-agent-slack-secrets.ps1 -Agent coach
.\scripts\start-personal.ps1 -NoAttach
.\scripts\start-slack-bridge.ps1
```

## Bandeja

Los mensajes entran a:

```text
personal_agent/inbox/slack.md
```

Tratar cada mensaje como solicitud pendiente. No ejecutar cambios destructivos, envíos externos ni acciones con gasto sin aprobación explícita.

