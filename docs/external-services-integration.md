# Integraciones Externas

Última actualización: 2026-05-16

Esta guía define cómo se conectan servicios externos a Colega, Coach y Socio. La regla base es: empezar con permisos mínimos, validar comportamiento real y separar credenciales por agente solo cuando aporte seguridad o claridad. Además, cada agente debe usar primero la integración nativa de su runtime/ecosistema cuando exista y sea estable; las herramientas compartidas quedan como fallback, verificación o puente temporal.

## Matriz De Servicios

| Servicio | Estado | Agentes | Uso principal | Riesgo |
| --- | --- | --- | --- | --- |
| Slack | Activo | Todos | Conversación diaria, rutinas, audio y deep research. | Medio |
| Gmail SMTP/App Password | Activo | Todos | Correos dedicados por agente. | Medio |
| Google Drive/Docs/Slides/Calendar | Implementado; requiere `verify` OK | Todos | Documentos, presentaciones, calendarios propios. | Medio |
| Notion | Activo | Todos | Tareas, memoria estructurada, salud, gastos, academia y negocio. | Medio |
| Vercel | Activo observer | Socio | Proyectos, deploys, dominios, eventos y errores. | Bajo |
| Voice Transcriber | Activo local | Coach/Socio/Colega fallback | Transcripción gratuita/local. | Bajo |
| GitHub | Pendiente | Coach/Socio | PRs, issues, revisión humana. | Medio |
| Analytics/Search Console | Pendiente | Socio | Métricas reales de crecimiento. | Medio |
| Redes sociales | Futuro | Socio | Contenido y campañas. | Alto |

## Notion

### Estado Actual

- Los tres agentes tienen `NOTION_API_KEY`.
- La integración compartida ve recursos de Notion.
- El mapa operativo vive en `config/notion-map.json`.
- Los agentes deben usar aliases del mapa antes de adivinar por nombre.
- Colega debe migrar Notion a MCP registrado en OpenClaw si el servidor MCP queda disponible y validado. Hasta entonces usa `agent_tools/notion_tool.mjs` solo como fallback/verificación.

Validación:

```powershell
.\scripts\validate-notion.ps1 -Agent all -Search
.\scripts\show-notion-map.ps1
```

Herramientas:

```powershell
node .\agent_tools\notion_tool.mjs map --agent coach
node .\agent_tools\notion_tool.mjs search --agent coach --query "gym"
node .\agent_tools\notion_tool.mjs create-record --agent coach --alias COACH_HABITS_DATABASE_ID --title "Revisar hábitos del día"
```

### Aliases Canónicos

Compartidos:

| Alias | Uso |
| --- | --- |
| `NOTION_PAGE_AGENTS_ID` | Página raíz del sistema de agentes. |
| `NOTION_TASKS_DATABASE_ID` | Lista general de tareas aprobadas o pendientes reales. |
| `NOTION_EXPENSES_DATABASE_ID` | Gastos personales o compartidos. |

Coach:

| Alias | Uso |
| --- | --- |
| `COACH_GYM_DATABASE_ID` | Registro canónico de ejercicios. |
| `COACH_FOOD_DATABASE_ID` | Registro de comidas y macros. |
| `COACH_FASTING_DATABASE_ID` | Ayuno intermitente. |
| `COACH_HABITS_DATABASE_ID` | Hábitos. |
| `COACH_SOCIAL_INTERACTIONS_DATABASE_ID` | Abordajes e interacciones sociales. |

Colega:

| Alias | Uso |
| --- | --- |
| `COLEGA_ENVIRONMENT_DATABASE_ID` | Gestión ambiental e investigación. |
| `COLEGA_TOPICS_DATABASE_ID` | Temas académicos. |
| `COLEGA_WATER_SYSTEMS_DATABASE_ID` | Acueductos/calidad de agua. |
| `COLEGA_COURSES_DATABASE_ID` | Asignaturas. |
| `COLEGA_READINGS_DATABASE_ID` | Lecturas y papers. |

Socio:

| Alias | Uso |
| --- | --- |
| `SOCIO_APPS_DATABASE_ID` | Aplicaciones/productos. |
| `SOCIO_EXPENSES_DATABASE_ID` | Gastos de negocio cuando aplique. |

### Reglas Operativas

- No registrar planes como si fueran hechos.
- Para gym, comida, gastos e interacciones sociales, crear registros solo cuando Primary User reporte datos reales.
- Si falta un dato, registrar lo disponible y marcar el faltante en observaciones/comentario.
- No usar bases legacy salvo compatibilidad explícita.
- No imprimir IDs/tokens como secretos: los IDs no son secretos, el token sí.

## Google Workspace

Ver guía dedicada: [deep-research-google-workspace.md](D:/Agents/docs/deep-research-google-workspace.md).

Estado:

- OAuth por agente con refresh token propio de cada cuenta Gmail dedicada.
- Scopes: Drive file, Docs, Slides y Calendar.
- Cada agente usa su propia cuenta Gmail/Drive/Calendar.

Uso:

| Agente | Drive/Docs/Slides |
| --- | --- |
| Colega | Investigaciones, clases, papers, bibliografía y entregas académicas; requiere `verify` OK. |
| Coach | Planes técnicos, reportes, documentación del stack y salud/hábitos cuando sea amplio; requiere `verify` OK. |
| Socio | Reportes de mercado, pitch decks, análisis de competencia y planes comerciales; requiere `verify` OK. |

Calendar:

- Cada agente crea eventos en su calendario propio.
- Primary User/Primary User ve esos calendarios compartidos desde su cuenta personal.
- Eventos con invitados externos, dinero o compromiso legal requieren confirmación.

## Gmail

Cada agente tiene Gmail dedicado y app password propia:

| Agente | Variables |
| --- | --- |
| Colega | `GMAIL_BOT_EMAIL`, `GMAIL_BOT_APP_PASSWORD` |
| Coach | `COACH_GMAIL_EMAIL`, `COACH_GMAIL_APP_PASSWORD` |
| Socio | `SOCIO_GMAIL_EMAIL`, `SOCIO_GMAIL_APP_PASSWORD` |

Comando:

```powershell
.\scripts\add-agent-gmail-secrets.ps1 -Agent colega
.\scripts\add-agent-gmail-secrets.ps1 -Agent coach
.\scripts\add-agent-gmail-secrets.ps1 -Agent socio
```

Herramienta:

```powershell
node .\agent_tools\send_agent_mail.mjs --agent colega --to correo@ejemplo.com --subject "Asunto" --text "Mensaje"
```

Política:

- Envío automático solo cuando el flujo lo indique.
- No usar el correo personal del humano como credencial del agente.
- No enviar compromisos externos, propuestas comerciales o invitaciones sin confirmación.

## Slack

Ver guía dedicada: [slack-integration.md](D:/Agents/docs/slack-integration.md).

Estado:

- Una Slack App por agente.
- Socket Mode activo.
- Colega prioriza Slack nativo OpenClaw.
- Coach/Socio usan Slack Bridge.
- Audio local con `voice_transcriber`.

## Vercel

Estado: Socio tiene acceso observer mediante `VERCEL_TOKEN`. Este modo permite diagnosticar proyectos, dominios, deployments, eventos y errores sin modificar Vercel.

Herramienta:

```powershell
node .\agent_tools\vercel_observer.mjs --action verify
node .\agent_tools\vercel_observer.mjs --action list-projects
node .\agent_tools\vercel_observer.mjs --action inspect-project --project project-alpha
node .\agent_tools\vercel_observer.mjs --action list-deployments --project Project Gamma-ia
node .\agent_tools\vercel_observer.mjs --action project-domains --project Project Beta
```

Alcance permitido:

- Ver usuario autenticado.
- Listar proyectos.
- Ver deploys.
- Ver dominios/aliases.
- Inspeccionar estado de proyectos.

No permitido en V1:

- Deploys.
- Rollbacks.
- Cambiar dominios.
- Modificar variables de entorno.
- Borrar proyectos.

Proyectos actuales:

```text
https://project-alpha.example.com/
https://Project Beta-mu.vercel.app/
https://project-gamma.example.com/
```

## GitHub

Estado: pendiente de implementación.

Objetivo:

- Coach y Socio pueden proponer cambios mediante PR.
- No deben hacer push directo a `main`.
- La aprobación ocurre en GitHub revisando PRs.
- Slack es el canal de aviso/resumen.

Diseño recomendado:

| Actor | Permiso |
| --- | --- |
| Coach | Crear ramas/PRs para cambios técnicos y mejoras del stack. |
| Socio | Crear issues/PRs para cambios en proyectos de negocio. |
| Colega | Normalmente sin acceso de escritura; puede pedir apoyo si necesita documentación académica. |
| Primary User/Primary User | Aprueba, comenta o mergea PRs. |

Protecciones recomendadas:

- Branch protection en `main`.
- Requerir PR.
- Requerir status checks.
- No permitir force push.
- CODEOWNERS para `secrets/`, `scripts/`, `docker-compose.yml`, `dashboard/` y `business_agent/`.
- Token con mínimo scope necesario.

Pendiente:

```text
GITHUB_TOKEN o GitHub App
Repo/owner objetivo
Política final de ramas
CI actualizado para dashboard + agent_tools
```

## Analytics Y Search Console

Estado: pendiente.

Uso principal de Socio:

- Medir crecimiento real.
- Ver páginas con tráfico.
- Detectar queries y oportunidades SEO.
- Medir comunidad combinada.
- Priorizar campañas y contenido.

Recomendación:

- Empezar con permisos de lectura.
- Usar una cuenta/propiedad por proyecto.
- No automatizar cambios ni publicación.
- Reportes semanales en Notion/Drive.

Métrica compuesta inicial:

```text
Comunidad ponderada =
clientes * 10
+ leads * 4
+ suscriptores email * 3
+ usuarios activos * 3
+ miembros comunidad * 2
+ seguidores * 1
+ visitas calificadas * 0.2
```

## Redes Sociales

Estado: futuro.

Secuencia recomendada:

1. Crear perfiles oficiales.
2. Socio propone calendario de contenido.
3. Publicación manual por Primary User.
4. Programación con aprobación.
5. Publicación directa solo cuando exista política clara de tono, marca, límites legales y revisión humana.

## Regla De Oro

Los agentes pueden observar, analizar, registrar y proponer. Cualquier acción externa con riesgo reputacional, legal, financiero o irreversible debe quedar confirmada por Primary User/Primary User.


