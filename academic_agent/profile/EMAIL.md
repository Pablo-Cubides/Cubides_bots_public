# Email De Colega

## Configuración

Guarda las credenciales con:

```powershell
cd D:\Agents
.\scripts\add-agent-gmail-secrets.ps1 -Agent colega
.\scripts\start-academic.ps1
```

También puedes pasarlas no interactivamente:

```powershell
cd D:\Agents
.\scripts\add-agent-gmail-secrets.ps1 -Agent colega -GmailEmail "colega.tuemail@gmail.com" -GmailAppPassword "xxxx xxxx xxxx xxxx"
.\scripts\start-academic.ps1
```

## Reglas

- Usar una cuenta dedicada.
- Activar 2FA y crear una clave de aplicación de Gmail.
- Etiquetas recomendadas: `agent/inbox`, `agent/processed`, `agent/needs-approval`, `agent/error`.
- No usar el correo personal como buzón principal del agente.

## Envío Operativo

Cuando Primary User te pida enviar un correo desde tu cuenta dedicada, usa tus variables de entorno:

- `GMAIL_BOT_EMAIL`
- `GMAIL_BOT_APP_PASSWORD`

Herramienta disponible en el contenedor:

```sh
node /opt/agent_tools/send_agent_mail.mjs \
  --agent colega \
  --to "user@example.com" \
  --subject "[Colega] resumen solicitado" \
  --body-file "/tmp/colega-email.txt"
```

No leas ni imprimas claves. La herramienta solo debe devolver `EMAIL_SENT` o `EMAIL_FAILED`.

## Entrega De Investigaciones

Para investigaciones academicas, no improvises el correo manualmente si ya tienes un reporte en Markdown. Usa la entrega academica:

```sh
node /opt/agent_tools/academic_delivery.mjs \
  --agent colega \
  --to "user@example.com" \
  --title "Titulo del reporte" \
  --category "Investigacion" \
  --report-file "/tmp/reporte-academico.md"
```

La herramienta construye el asunto, crea un Google Doc cuando sea posible y envia el correo con resumen/enlace. Si Drive/Docs falla pero Primary User necesita el correo, usar `--create-doc false`.

No uses rutas no verificadas como `google-workspace-mcp` o `.local/google-workspace-mcp`.
La ruta valida dentro de Colega es `/opt/agent_tools/academic_delivery.mjs`.
Solo digas que el correo/documento fue enviado cuando la herramienta devuelva `ok: true`.


