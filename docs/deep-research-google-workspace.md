# Google Workspace Y Deep Research

Última actualización: 2026-05-20

Esta guía documenta la conexión OAuth de Google Drive, Docs, Slides y Calendar para los tres agentes, además del runner asíncrono de investigación profunda.

## Objetivo

Permitir que Colega, Coach y Socio creen documentos, presentaciones y eventos en sus propias cuentas Google, sin usar el calendario personal del humano ni depender de copiar/pegar resultados extensos en Slack.

## Estado Actual

| Agente | OAuth Google | Drive/Docs/Slides | Calendar | Uso principal |
| --- | --- | --- | --- | --- |
| Colega | Implementado; requiere token vigente | Activo si `verify` pasa | Activo si `verify` pasa | Investigación académica, clases, bibliografía y entregas por correo. |
| Coach | Implementado; requiere token vigente | Activo si `verify` pasa | Activo si `verify` pasa | Planes técnicos, salud/hábitos amplios y documentación del stack. |
| Socio | Implementado; requiere token vigente | Activo si `verify` pasa | Activo si `verify` pasa | Reportes de mercado, pitch decks, competencia y planes comerciales. |

Google puede invalidar refresh tokens si se revoca el acceso, cambia el cliente OAuth, cambia el usuario autorizado, se elimina el cliente o la app OAuth exige nuevo consentimiento. En ese caso el código no cambia: se reautoriza el agente y se regenera `secrets/runtime/*.env`.

## Scopes

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/presentations
https://www.googleapis.com/auth/calendar
```

Razón:

- `drive.file`: limita el acceso a archivos creados/abiertos por la app.
- `documents`: permite crear/editar Google Docs.
- `presentations`: permite crear/editar Google Slides.
- `calendar`: permite crear/ver el calendario propio del agente y crear eventos allí.

## OAuth Por Agente

Cada JSON OAuth corresponde a un agente:

| Agente | JSON |
| --- | --- |
| Socio | `client_secret_328626787812-...json` |
| Colega | `client_secret_1066100543154-...json` |
| Coach | `client_secret_1057815811613-...json` |

Autorizar:

```powershell
cd D:\Agents

.\scripts\google-oauth-agent.ps1 -Agent socio -NoBrowser -ClientSecretPath "RUTA_AL_JSON_SOCIO"

.\scripts\google-oauth-agent.ps1 -Agent colega -NoBrowser -ClientSecretPath "RUTA_AL_JSON_COLEGA"

.\scripts\google-oauth-agent.ps1 -Agent coach -NoBrowser -ClientSecretPath "RUTA_AL_JSON_COACH"
```

Con `-NoBrowser`, el script imprime un link; pégalo manualmente en la ventana/perfil correcto del agente.

Después de autorizar:

```powershell
.\scripts\start-academic.ps1
.\scripts\start-personal.ps1 -NoAttach
.\scripts\start-business.ps1 -NoBuild
```

## Verificación

```powershell
node .\agent_tools\google_workspace.mjs --agent colega --action verify
node .\agent_tools\google_workspace.mjs --agent coach --action verify
node .\agent_tools\google_workspace.mjs --agent socio --action verify
```

Crear/verificar estructura después de que `verify` pase:

```powershell
node .\agent_tools\google_workspace.mjs --agent colega --action ensure
node .\agent_tools\google_workspace.mjs --agent coach --action ensure
node .\agent_tools\google_workspace.mjs --agent socio --action ensure
```

Si aparece `insufficient authentication scopes`, el token fue generado con scopes antiguos. Si aparece `invalid_grant`, el refresh token fue revocado o invalidado por Google. En ambos casos reautoriza el agente con `google-oauth-agent.ps1` y reinicia el agente correspondiente para regenerar `secrets/runtime/*.env`.

## Estructura En Drive

Cada agente mantiene su propio `Agents Hub`:

```text
Agents Hub/
  00_Inbox/
  01_Deep_Research/
  02_Rutinas/
  03_Reunion_Dominical/
  04_Memoria/
  05_Slides/
```

Categorías por agente:

| Agente | Categorías |
| --- | --- |
| Colega | `Docencia`, `Investigacion`, `Congresos_Convocatorias`, `Papers_Bibliografia`, `Marca_Academica`, `Clases_Presentaciones` |
| Coach | `Salud`, `Relaciones`, `Freelance_Tecnico`, `Habitos`, `Stack_Agentes`, `Planes_Visuales` |
| Socio | `Project_Alpha`, `Project Beta`, `Project_Gamma`, `Mercado_Competencia`, `Marketing_SEO`, `Pitch_Decks` |

## Calendarios

Cada agente crea eventos en su calendario propio:

```text
Colega - Agenda
Coach - Agenda
Socio - Agenda
```

Reglas:

- Primary User/Primary User puede ver esos calendarios si los agentes los comparten.
- Los agentes no editan el calendario personal.
- Eventos internos pueden crearse directamente.
- Eventos con invitados externos, dinero, compromiso legal o envío de invitaciones requieren confirmación.
- Usar prefijos: `[Colega]`, `[Coach]`, `[Socio]`.

## Deep Research Runner

El runner corre en el host local y procesa jobs largos sin bloquear Slack.

Iniciar:

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

Logs y estado:

```text
logs/deep-research-runner.log
.tmp/deep-research/jobs/
.tmp/deep-research/state/
```

## Disparadores Desde Slack

El bridge encola deep research cuando detecta frases como:

```text
investiga profundamente
analiza a fondo
estado del arte
benchmark
revisión bibliográfica
paper
congreso
convocatoria
haz una presentación
pitch deck
```

Respuesta esperada:

1. Slack confirma que la investigación fue iniciada.
2. El runner trabaja en segundo plano.
3. Al terminar, publica resumen + enlace al Doc + enlace a Slides si aplica.

## Modelos Profundos

| Agente | Modelo profundo |
| --- | --- |
| Colega | OpenClaw con perfil `deep` |
| Coach | Claude `opus` / `opusplan` según tarea |
| Socio | `gemini-2.5-pro` |

## Entrega Académica De Colega

Colega puede ejecutar un flujo académico:

```text
investigación nativa OpenClaw
→ Google Doc / Markdown
→ resumen
→ correo desde Gmail de Colega
```

Herramienta:

```powershell
node .\agent_tools\academic_delivery.mjs --help
```

Uso esperado:

- informes académicos;
- síntesis para clase;
- revisión de papers;
- convocatorias/congresos;
- envío de resumen o enlace por correo cuando Primary User lo pida.

## Seguridad

- El runner no acepta comandos arbitrarios.
- Solo procesa jobs JSON con campos permitidos.
- Sanitiza logs y no imprime tokens.
- No borra archivos de Drive.
- Puede moverse a contenedor dedicado si el volumen de jobs crece.

## Prueba Manual

```powershell
node .\agent_tools\deep_research_runner.mjs --enqueue true --agent colega --title "Prueba profunda Colega" --category Investigacion --prompt "Investiga oportunidades recientes sobre calidad del agua e inteligencia artificial." --slides true

.\scripts\start-deep-research-runner.ps1 -Once
```

Verifica:

- Doc creado en Drive del agente.
- Slides creadas si `--slides true`.
- Logs sin secretos.
- Slack recibe el resumen si el job venía desde Slack.


