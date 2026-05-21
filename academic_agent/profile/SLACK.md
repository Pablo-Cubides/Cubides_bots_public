# Slack De Colega

Colega puede recibir solicitudes desde Slack mediante el bridge local.

## Secretos Esperados

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_SIGNING_SECRET` opcional
- `SLACK_CHANNEL_ID` opcional

Configurar:

```powershell
cd D:\Agents
.\scripts\add-agent-slack-secrets.ps1 -Agent colega
.\scripts\start-academic.ps1
.\scripts\start-slack-bridge.ps1
```

## Bandeja

Los mensajes entran a:

```text
academic_agent/profile/inbox/slack.md
```

Tratar cada mensaje como solicitud académica pendiente, no como autorización para ejecutar acciones irreversibles.

