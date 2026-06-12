# Prompt de extracción de ideas — Academy (v2: carruseles con variedad visual)

Genera el CSV que consume el generador de carruseles. A diferencia de la v1, cada
carrusel ahora se descompone en **slides de desarrollo distintos** (slide 2, slide 3 y,
opcionalmente, slide 4), cada uno con su propia información y su propio gráfico.

Mapeo CSV → slides del carrusel:

| Columna(s)                          | Slide del carrusel                                  |
| ----------------------------------- | --------------------------------------------------- |
| `titulo` + `sugerencia_visual`      | Slide 1 (portada) y motivo "hero" reutilizado en el cierre |
| `concepto_clave`                    | Idea global; base del resumen del último slide       |
| `slide2_concepto` + `slide2_visual` | Slide 2 (desarrollo #1)                              |
| `slide3_concepto` + `slide3_visual` | Slide 3 (desarrollo #2)                              |
| `slide4_concepto` + `slide4_visual` | Slide 4 (desarrollo #3) — **opcional**, solo carruseles de 5 slides |
| `capitulo_referencia`/`pagina_referencia` | Referencia, visible solo en el último slide   |

La app deriva portada y cierre automáticamente; tú solo aseguras que los slides de
desarrollo aporten **información diferente** y **gráficos de distinto tipo**.

---

## PROMPT (copiar y pegar)

Actúa como un editor de contenido médico-educativo especializado en fisioterapia y rehabilitación. Tu tarea es analizar el libro "Fisioterapia Invasiva del Síndrome de Dolor Miofascial" y extraer exactamente 50 ideas para carruseles informativos de Instagram/LinkedIn dirigidos a profesionales de la salud.

CONTEXTO DE LA MARCA:
- Nombre: Academy by Total Therapy
- Audiencia: Licenciados en Terapia Física y Rehabilitación, doctores, especialistas en medicina física.
- Tono: Educativo, basado en evidencia, profesional pero accesible. Nunca condescendiente.
- Estilo visual esperado: Diagramas anatómicos limpios, esquemas de dolor referido, comparativas clínicas, infografías médicas con tipografía clara.

ESTRUCTURA DE CADA CARRUSEL (MUY IMPORTANTE):
Cada idea se publica como un carrusel de 4 slides (a veces 5). No describas un solo gráfico para toda la idea: descompón la idea en una narrativa con slides que muestran COSAS DISTINTAS.
- Slide 1 — Portada: gancho clínico, gráfico "hero" llamativo (lo defines en `sugerencia_visual`).
- Slide 2 — Desarrollo #1: un sub-concepto concreto de la idea, con su propio gráfico.
- Slide 3 — Desarrollo #2: OTRO sub-concepto distinto de la idea, con OTRO tipo de gráfico.
- Slide 4 (opcional) — Desarrollo #3: solo si la idea da para un tercer ángulo sólido.
- Último slide — Cierre/resumen: lo deriva la app a partir de `concepto_clave` y la portada; no lo describas tú.

REGLA DE VARIEDAD (la más importante de esta versión):
1. `slide2_concepto` y `slide3_concepto` deben ser sub-ideas DIFERENTES entre sí. No pueden ser paráfrasis del mismo enunciado ni del `concepto_clave`. Cada una aporta información nueva del libro (un mecanismo, un dato, una clasificación, una comparación, un paso de la técnica, una contraindicación, etc.).
2. `slide2_visual` y `slide3_visual` deben ser de TIPO de gráfico distinto entre sí y distinto a la portada. Varía deliberadamente el formato: anatomía → tabla comparativa → diagrama de mecanismo/proceso → línea de tiempo → checklist → corte transversal → gráfico de barras simple. Nunca repitas "infografía del músculo X con zoom" en dos slides.
3. La portada (`sugerencia_visual`) y el cierre pueden compartir el mismo motivo "hero"; eso da coherencia y está permitido. La variedad se exige solo entre los slides de desarrollo.

INSTRUCCIONES DE EXTRACCIÓN:
1. Recorre el libro capítulo por capítulo. Para cada concepto clínico relevante, crea una idea de carrusel.
2. Cada idea debe ser educativa e interesante para un profesional de la salud. Evita obviedades; prioriza insights clínicos aplicables.
3. El contenido debe ser 100% fiel al libro. NO inventes datos, estadísticas ni referencias que no estén en el texto. Esto aplica también a cada sub-concepto de los slides de desarrollo.
4. Cada idea debe incluir obligatoriamente la referencia exacta al capítulo y, si es posible, al rango de páginas.
5. Si la idea no da para dos sub-conceptos genuinamente distintos del libro, elige otra idea más rica: no rellenes slide3 repitiendo slide2.

FORMATO DE SALIDA:
Devuelve el resultado en formato CSV con EXACTAMENTE estas columnas y en este orden:
- id: Número correlativo (1 al 50)
- titulo: Título atractivo y profesional para el carrusel (máx. 8 palabras)
- concepto_clave: Descripción en 2-3 oraciones de la idea global del carrusel. Incluye el insight clínico principal.
- publico_objetivo: "Licenciados en Terapia Física" o "Doctores y especialistas" (selecciona el más apropiado según la complejidad del tema)
- capitulo_referencia: Nombre exacto del capítulo del libro
- pagina_referencia: Rango de páginas (ej. "45-52")
- sugerencia_visual: Gráfico "hero" de la PORTADA. Llamativo, una sola idea visual fuerte, poco texto. Sé específico.
- slide2_concepto: Sub-concepto #1 (información concreta y fiel al libro) que se explica en el slide 2. 1-2 oraciones.
- slide2_visual: Gráfico específico del slide 2 (debe ser de distinto tipo que la portada).
- slide3_concepto: Sub-concepto #2 DISTINTO al de slide2, que se explica en el slide 3. 1-2 oraciones.
- slide3_visual: Gráfico específico del slide 3 (de distinto tipo que la portada y que slide2).
- slide4_concepto: (Opcional) Sub-concepto #3 distinto, solo si la idea lo justifica; si no, déjalo vacío.
- slide4_visual: (Opcional) Gráfico del slide 4; vacío si no se usa.
- estado: "pendiente" (para todas)

CRITERIOS DE CALIDAD POR IDEA:
- ¿Aporta algo que un licenciado no sepa ya de memoria?
- ¿Tiene aplicación clínica directa?
- ¿Es visualizable? (¿Se puede representar en una imagen/diagrama?)
- ¿Está anclada a una fuente real del libro?
- ¿Los slides 2 y 3 dicen cosas DISTINTAS y se ven DISTINTOS?

ADVERTENCIAS:
- No generes ideas sobre temas que no estén en el libro.
- No uses lenguaje de marketing cliché.
- Varía los formatos de gráfico entre slides de desarrollo (anatomía, tabla, mecanismo, proceso, comparativa, checklist).
- Varía también el formato narrativo entre ideas: algunas "mito vs. realidad", otras "anatomía práctica", otras "caso clínico ilustrado", otras "fisiopatología simplificada".
- Encierra entre comillas dobles cualquier campo que contenga comas.

ENTREGA:
Genera 50 filas con las 14 columnas indicadas.
