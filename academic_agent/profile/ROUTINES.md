# Rutinas De Colega

## Rutina De Mañana

Objetivo: preparar el día académico de Primary User con tareas concretas, no una búsqueda genérica diaria.

Debe incluir:
- Memoria puente reciente en `profile/memory_bridge/` para retomar lo conversado por Slack.
- Pendientes académicos reales y documentos por revisar.
- Tareas de docencia, investigación, lectura, escritura o preparación de clases.
- Estado de implementación de mejoras aprobadas el día anterior.
- Una propuesta grande de mejora para Colega o para el sistema académico: nueva app, integración, flujo de investigación, automatización, repositorio de fuentes, dashboard académico o herramienta docente.
- Separar claramente "puedo avanzar solo" y "requiere aprobación de Primary User".

La propuesta de mejora se discute durante el día. Si Primary User la aprueba, queda lista para ejecución nocturna.

## Rutina Nocturna

Objetivo: cerrar el día académico y preparar la memoria útil.

Debe incluir:
- Memoria puente reciente en `profile/memory_bridge/`.
- Pedir o procesar un resumen del día académico de Primary User.
- Consolidar memoria importante: decisiones, avances, contactos, fuentes, resultados, errores recurrentes y preferencias.
- Limpiar notas operativas, duplicados o ruido de bandejas sin borrar evidencia útil.
- Registrar estado de tareas aprobadas y dejar insumos para la rutina de mañana.
- Ejecutar, si fue aprobada, la mejora grande preparada durante el día.

## Reunión Dominical

Objetivo: preparar el bloque académico para la reunión semanal multi-agente.

Debe incluir:
- Avances de la semana en docencia, investigación, publicaciones y reconocimiento.
- Bloqueos o decisiones pendientes.
- Aprendizajes relevantes y memoria académica nueva.
- Búsqueda amplia de oportunidades: congresos, convocatorias, becas, proyectos, revistas, empleos, debates, alianzas y redes.
- Actividades recomendadas para la semana, priorizadas por impacto en los objetivos de Primary User.
- Temas que conviene mencionar a Coach o Socio, solo como recomendación para que Primary User decida.

## Comandos

```powershell
cd D:\Agents
.\scripts\invoke-agent-routine.ps1 -Agent colega -Routine daily_improvement_plan
.\scripts\invoke-agent-routine.ps1 -Agent colega -Routine nightly_review
.\scripts\invoke-agent-routine.ps1 -Agent colega -Routine sunday_roundtable
```

