# Schema De Coach Life Wiki

## Principios

1. **Situaciones antes que personas.** Registrar personas solo si son relevantes para entender el patron y con minimo detalle necesario.
2. **Separar dato de interpretacion.** Lo reportado por Primary User no es automaticamente una conclusion.
3. **Buscar repeticion.** Una situacion aislada va a `situations/`; tres o mas situaciones relacionadas pueden justificar un `pattern/`.
4. **Experimentos pequenos y revisables.** Cada recomendacion debe poder probarse y revisarse.
5. **Privacidad por diseno.** No incluir datos sensibles innecesarios ni detalles intimos de terceros.
6. **Tono constructivo.** El objetivo es mejorar, no juzgar.

## Tipos De Pagina

### Raw Entry

Ubicacion: `raw/YYYY-MM-DD-slug.md`

Campos:

- fecha;
- dominio;
- fuente;
- resumen breve;
- texto o notas;
- posibles enlaces a situaciones/patrones.

### Situation

Ubicacion: `situations/YYYY-MM-DD-slug.md`

Secciones:

- Contexto;
- Que paso;
- Estado interno observado;
- Decisiones o acciones;
- Resultado;
- Aprendizajes;
- Posibles patrones relacionados;
- Siguiente experimento.

### Pattern

Ubicacion: `patterns/slug.md`

Secciones:

- Descripcion del patron;
- Situaciones relacionadas;
- Senales tempranas;
- Hipotesis;
- Que ayuda;
- Que empeora;
- Experimentos propuestos;
- Estado actual.

### Domain

Ubicacion: `domains/<dominio>.md`

Dominios iniciales:

- `salud`;
- `relaciones`;
- `confianza_social`;
- `productividad`;
- `dinero_freelance`;
- `stack_agentes`;
- `emociones`;
- `habitos`.

### Experiment

Ubicacion: `experiments/YYYY-MM-DD-slug.md`

Secciones:

- Hipotesis;
- Accion;
- Duracion;
- Metrica;
- Resultado esperado;
- Revision;

## Flujo De Trabajo

### Ingest

Cuando Primary User cuente una vivencia importante:

1. Crear entrada raw.
2. Crear o actualizar situacion si hay un momento concreto.
3. Buscar patrones relacionados.
4. Si hay evidencia repetida, actualizar una pagina de pattern.
5. Agregar entrada a `log.md`.
6. Actualizar `index.md` si se crea una pagina nueva.

### Query

Para responder preguntas como "que se repite en mis salidas":

1. Leer `index.md`.
2. Buscar en `patterns/`, `situations/` y `domains/`.
3. Responder con citas de paginas.
4. Si el analisis es valioso, guardarlo como pagina nueva o actualizar una existente.

### Lint Semanal

Revisar:

- paginas sin enlaces;
- patrones sin situaciones;
- situaciones sin aprendizaje;
- experimentos sin revision;
- dominios desactualizados;
- contradicciones o datos viejos.

