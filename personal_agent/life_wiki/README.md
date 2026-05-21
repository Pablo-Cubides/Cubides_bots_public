# Coach Life Wiki

Wiki personal mantenida por Coach para convertir vivencias, rutinas y conversaciones importantes en aprendizaje acumulativo.

La idea base sigue el patron "LLM Wiki": no depender de memoria conversacional larga ni de RAG bruto, sino mantener una capa intermedia de Markdown estructurado que se actualiza con cada vivencia relevante.

## Proposito

- Detectar situaciones repetidas.
- Entender patrones emocionales, sociales, de salud, productividad y dinero.
- Proponer experimentos concretos de mejora.
- Evitar que los aprendizajes queden perdidos en Slack.
- Separar hechos observados, interpretaciones e hipotesis.

## Capas

- `raw/`: entradas casi crudas, con contexto y fecha. No se reescriben salvo correcciones claras.
- `situations/`: momentos o vivencias especificas, sin convertir todo en "personas".
- `patterns/`: patrones recurrentes que aparecen en varias situaciones.
- `domains/`: sintesis por area de vida.
- `experiments/`: acciones probables para mejorar, con resultado esperado y revision.
- `weekly_reviews/`: revisiones semanales.
- `index.md`: mapa navegable.
- `log.md`: registro cronologico.

## Regla Principal

No crear paginas centradas en personas salvo que la persona sea realmente relevante para un patron estable. Preferir paginas centradas en:

- situaciones;
- momentos;
- contextos;
- decisiones;
- bloqueos;
- reacciones emocionales;
- aprendizajes;
- experimentos.

## Uso Rapido

Desde `D:\Agents`:

```powershell
node .\agent_tools\life_wiki.mjs status
node .\agent_tools\life_wiki.mjs ingest --domain relaciones --title "Noche en social event" --text "..."
node .\agent_tools\life_wiki.mjs search --query "confianza"
node .\agent_tools\life_wiki.mjs lint
```

Dentro del contenedor de Coach:

```bash
node ../agent_tools/life_wiki.mjs status
```


