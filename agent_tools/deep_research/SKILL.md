---
name: deep-research-protocol
description: Use this protocol when an agent must perform a long, source-grounded investigation and save the result to its own Google Drive as Docs/Slides.
---

# Deep Research Protocol

Use this workflow for requests such as "investiga profundamente", "analiza a fondo", "estado del arte", "benchmark", "revisión bibliográfica", "convocatorias", "competidores", or any task that needs source-grounded synthesis instead of a short chat answer.

## Workflow

1. Define the objective, audience, decision to support, scope, and expected output.
2. Break the work into 3-7 research questions.
3. Prefer primary sources, official docs, papers, direct product/company pages, datasets, and recent authoritative references.
4. Cross-check important claims against multiple sources when possible.
5. Separate facts, inferences, recommendations, and uncertainties.
6. Produce a complete Spanish report with:
   - resumen ejecutivo
   - pregunta investigada
   - plan de investigacion
   - hallazgos clave
   - fuentes/citas
   - riesgos e incertidumbre
   - recomendaciones
   - acciones sugeridas
   - memoria que debe conservarse
7. Save the final report to the agent's own Google Drive through `agent_tools/google_workspace.mjs`.
8. Create Google Slides when the request asks for a presentation, class, pitch, deck, visual summary, or material to present.

## Agent-Specific Categories

- Colega: `Docencia`, `Investigacion`, `Congresos_Convocatorias`, `Papers_Bibliografia`, `Marca_Academica`, `Clases_Presentaciones`.
- Coach: `Salud`, `Relaciones`, `Freelance_Tecnico`, `Habitos`, `Stack_Agentes`, `Planes_Visuales`.
- Socio: `Project_Alpha`, `Project Beta`, `Project_Gamma`, `Mercado_Competencia`, `Marketing_SEO`, `Pitch_Decks`.

## Safety

- Never print Google tokens, refresh tokens, client secrets, app passwords, or runtime env values.
- Do not create calendar events with external guests, legal commitments, or payments unless Primary User/Primary User explicitly authorizes that specific action.
- Internal events in the agent's own calendar are allowed when requested.


