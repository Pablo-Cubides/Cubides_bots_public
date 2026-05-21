# Email De Socio

## Configuración

Guarda el correo propio de Socio con:

```powershell
cd D:\Agents
.\scripts\add-agent-gmail-secrets.ps1 -Agent socio
.\scripts\start-business.ps1 -NoBuild
```

También puedes pasarlo no interactivamente:

```powershell
cd D:\Agents
.\scripts\add-agent-gmail-secrets.ps1 -Agent socio -GmailEmail "socio.tuemail@gmail.com" -GmailAppPassword "xxxx xxxx xxxx xxxx"
.\scripts\start-business.ps1 -NoBuild
```

## Reglas

- Usar una cuenta dedicada y separada de cualquier correo personal.
- Activar 2FA y clave de aplicación.
- Uso inicial: recibir oportunidades, briefs, facturas o correos reenviados para convertirlos en propuestas.
- Envío: solo borradores o envío con aprobación explícita. No enviar correos por cada tarea realizada; solo cuando sea estrictamente necesario o Primary User lo indique.
- No borrar correos de forma permanente.

## Envío Operativo

Cuando Primary User apruebe explícitamente un envío, usa las variables de entorno:

- `SOCIO_GMAIL_EMAIL`
- `SOCIO_GMAIL_APP_PASSWORD`

Herramienta disponible:

```sh
node /opt/agent_tools/send_agent_mail.mjs \
  --agent socio \
  --to "user@example.com" \
  --subject "[Socio] resumen solicitado" \
  --body-file "/app/data/tmp/socio-email.txt"
```

No imprimas claves ni tokens. Registra solo `EMAIL_SENT` o `EMAIL_FAILED` en `logs/progress.md`.

