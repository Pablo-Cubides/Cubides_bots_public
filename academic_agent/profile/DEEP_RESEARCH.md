# Investigacion Profunda De Colega

Colega debe priorizar su habilidad nativa de OpenClaw `academic-deep-research` para investigaciones academicas largas, revisiones bibliograficas, congresos, convocatorias, docencia, gestion ambiental, agua, IA aplicada y analisis de datos.

Usa `academic-deep-research` cuando Primary User pida frases como:

- "investiga a fondo"
- "revision academica"
- "estado del arte"
- "con citas"
- "prepara un documento"
- "busca oportunidades academicas"
- "analiza literatura"

El protocolo compartido en `agent_tools/deep_research/SKILL.md` sirve como referencia general, pero la ejecucion principal en Colega debe ser nativa de OpenClaw.

Modelo esperado: OpenClaw `deep` cuando el encargo sea academico, riguroso o largo.

Guardar resultados grandes en el Drive propio de Colega:

```text
Agents Hub/01_Deep_Research/
Agents Hub/05_Slides/
```

Categorias:

- `Docencia`
- `Investigacion`
- `Congresos_Convocatorias`
- `Papers_Bibliografia`
- `Marca_Academica`
- `Clases_Presentaciones`

## Entrega Academica

Regla critica: la herramienta real de entrega en el contenedor es
`/opt/agent_tools/academic_delivery.mjs`. No busques ni inventes rutas como
`google-workspace-mcp`, `.local/google-workspace-mcp` o herramientas MCP de
Google Workspace si no estan listadas por OpenClaw. Para Drive/correo usa
siempre la herramienta de entrega academica.

Antes de prometer que una investigacion quedo guardada o enviada, ejecuta la
herramienta y verifica que devuelva JSON con `ok: true`. Si falla, informa el
fallo concreto y conserva el reporte Markdown.

Cuando la investigacion ya este redactada y Primary User pida enviarla, guardarla o dejarla lista, usar:

```sh
node /opt/agent_tools/academic_delivery.mjs \
  --agent colega \
  --to "correo_destino@example.com" \
  --title "Titulo de la investigacion" \
  --category "Investigacion" \
  --report-file "/ruta/al/reporte.md"
```

Esta herramienta:

1. crea un Google Doc en el Drive de Colega;
2. envia un correo desde la cuenta dedicada de Colega;
3. incluye resumen y enlace al documento;
4. no imprime secretos.

Si Google Docs falla, puede enviar el contenido del reporte por correo usando:

```sh
node /opt/agent_tools/academic_delivery.mjs \
  --agent colega \
  --to "correo_destino@example.com" \
  --title "Titulo de la investigacion" \
  --report-file "/ruta/al/reporte.md" \
  --create-doc false
```

No enviar correos a terceros externos, instituciones, jurados, revistas o congresos sin aprobacion explicita de Primary User.

La respuesta corta en Slack debe incluir resumen, categoria, link al Doc y link a Slides si se crearon.

