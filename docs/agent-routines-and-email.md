# Rutinas Y Correos Propios De Agentes

## Comandos Para Correos

Cada agente debe tener su propio Gmail dedicado. Crea la cuenta, activa 2FA y genera una clave de aplicación. Luego ejecuta:

```powershell
cd D:\Agents
.\scripts\add-agent-gmail-secrets.ps1 -Agent colega
.\scripts\add-agent-gmail-secrets.ps1 -Agent coach
.\scripts\add-agent-gmail-secrets.ps1 -Agent socio
```

Si Socio aun no tiene archivo cifrado, primero crea `secrets/business.enc.yaml`:

```powershell
cd D:\Agents
.\scripts\secrets-setup-business.ps1
```

Reinicia cada agente después de guardar secretos:

```powershell
cd D:\Agents
.\scripts\start-academic.ps1
.\scripts\start-personal.ps1 -NoAttach
.\scripts\start-business.ps1 -NoBuild
```

Variables guardadas por agente:

| Agente | Archivo cifrado | Variables |
| --- | --- | --- |
| Colega | `secrets/academic.enc.yaml` | `GMAIL_BOT_EMAIL`, `GMAIL_BOT_APP_PASSWORD` |
| Coach | `secrets/personal.enc.yaml` | `COACH_GMAIL_EMAIL`, `COACH_GMAIL_APP_PASSWORD` |
| Socio | `secrets/business.enc.yaml` | `SOCIO_GMAIL_EMAIL`, `SOCIO_GMAIL_APP_PASSWORD` |

El dashboard solo debe mostrar presencia/ausencia de estas variables, nunca sus valores.

## Comandos Para Rutinas

Las rutinas ahora son conversacionales: publican en Slack, usan hora `America/Bogota` y guardan memoria local. Ver tambien `docs/routine-conversations.md`.

Levantar el orquestador host-local:

```powershell
cd D:\Agents
.\scripts\start-routine-orchestrator.ps1 -Detached
```

Ejecutar rutina de mañana manualmente:

```powershell
cd D:\Agents
.\scripts\invoke-agent-routine.ps1 -Agent all -Routine daily_improvement_plan
```

Ejecutar reporte dominical manualmente:

```powershell
cd D:\Agents
.\scripts\invoke-agent-routine.ps1 -Agent all -Routine sunday_roundtable
```

Programarlas en Windows:

```powershell
cd D:\Agents
.\scripts\install-agent-routines-schedule.ps1 -DailyTime "08:05" -NightlyTime "21:30" -SundayTime "17:00"
```

## Estructura Por Agente

- Colega: perfil versionado en `academic_agent/profile/`; OpenClaw mantiene su runtime persistente dentro del volumen `misbots_openclaw_data`.
- Coach: mantiene `CLAUDE.md`, `MEMORY.md`, `EMAIL.md` y `ROUTINES.md`.
- Socio: mantiene `identity/`, `memory/`, `tasks/`, `logs/` y `.agent/`; las rutinas viven en `business_agent/data/.agent/ROUTINES.md`.

## Estado Actual De Integracion

- Los correos estan preparados como secretos cifrados y runtime env.
- La lectura/envio automatico de correo aun no debe hacerse sin aprobacion explicita.
- Slack tiene bridge local propio; Telegram sigue como canal futuro.
- Las rutinas ya no son colas pasivas; se ejecutan como conversaciones por Slack. Drive se usa solo para reportes grandes, investigaciones o presentaciones.

Slack ahora tiene configuracion separada en `docs/slack-integration.md`.

## Política De Seguridad

- No usar el correo personal como buzón del agente.
- No dar permisos de borrado permanente.
- Enviar correos solo con aprobación explícita.
- Mostrar presencia de credenciales, nunca valores.

