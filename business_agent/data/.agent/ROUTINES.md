# Rutinas De Socio

Socio ya usa `identity/`, `memory/`, `tasks/`, `logs/` y `.agent/skills/`. Estas rutinas se apoyan en esa estructura, no la reemplazan.

Antes de cada rutina, el estado autorizado vive en:

```text
business_agent/data/memory/current_state.md
```

Ese estado prevalece sobre memorias antiguas.

## Rutina De Mañana

Objetivo: preparar el día de negocios de Primary User con acciones concretas para crecer las empresas.

Debe revisar:
- Pendientes reales en Project Alpha, Project Beta y Project Gamma.
- Tareas del día para webs, contenido, redes, publicidad, analítica, funnels, comunidad y ventas.
- Estado de implementación si Primary User aprobó una mejora el día anterior.
- Métricas combinadas: seguidores, usuarios activos, clientes, lista de correo, comunidad, visitas calificadas, leads y conversiones.
- Una propuesta grande de mejora para Socio o para las empresas: nueva integración, app interna, analítica, automatización comercial, landing, CRM, bot, scraping legal, contenido programático o dashboard.
- Propuestas separadas entre "puedo analizar solo" y "requiere aprobación".
- Estado real de Vercel cuando aplique, usando `vercel_observer.mjs` y no `.gemini/settings.json`.

La propuesta grande se aprueba durante el día. Si Primary User la aprueba, puede ejecutarse en la noche.

## Rutina Nocturna

Objetivo: cerrar el día de negocio y consolidar memoria operativa.

Debe revisar:
- Solicitar o procesar resumen del día en ventas, ideas, contactos, contenido, métricas y decisiones.
- Registrar memoria importante: decisiones, hallazgos, métricas, competidores, campañas, errores recurrentes, oportunidades y preferencias de Primary User.
- Limpiar logs, findings y task_plan sin borrar evidencia útil.
- Dejar insumos para la rutina de mañana.
- Ejecutar la mejora grande aprobada durante el día, si existe aprobación explícita.

## Reunión Dominical

Objetivo: preparar el bloque de negocios para la reunión semanal multi-agente.

Debe incluir:
- Avances y hallazgos de la semana.
- Oportunidades priorizadas para Project Alpha, Project Beta y Project Gamma.
- Investigación del líder del sector de cada proyecto y estimación de la comunidad objetivo del 10%.
- Riesgos legales, reputacionales, comerciales y presupuestales.
- Campañas, contenidos, experimentos, alianzas y automatizaciones sugeridas para la semana.
- Actividades recomendadas para la semana, priorizadas por impacto y esfuerzo.
- Temas que conviene recomendar a Coach o Colega para que Primary User decida si los transfiere.

## Bandeja Operativa

Socio Lite sí tiene daemon. Las tareas reales se agregan a:

```text
business_agent/data/tasks/task_plan.md
```


