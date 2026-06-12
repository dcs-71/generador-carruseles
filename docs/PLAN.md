# PLAN.md — Academy Carousel Generator

> Documento SDD · Borrador inicial para revisión individual.
> Idioma de trabajo: español. Stack y comportamiento reflejan el producto actual del repositorio.

## 1. Propósito del proyecto

Aplicación de escritorio (Electron, macOS) que permite **generar, revisar, regenerar, aprobar y exportar carruseles educativos** de 4 o 5 slides cuadrados (1:1) para las redes sociales de **Academy by Total Therapy**, partiendo de un CSV de ideas y aplicando lineamientos de marca Academy fijos embebidos en cada prompt.

## 2. Problema que resuelve

El equipo de contenido necesita producir, de forma **frecuente y consistente**, carruseles médicos (fisioterapia invasiva / punción seca) alineados a la identidad Academy. Hacerlo a mano por slide es lento, inconsistente y difícil de trazar. El proyecto automatiza el paso de **idea validada → carrusel listo para revisión**, conservando trazabilidad (prompt, modelo, parámetros, estado, archivos) y manteniendo la marca bajo control.

## 3. Objetivo principal

Convertir un lote de ideas (CSV) en carruseles PNG 1:1 generados con un modelo de imagen de Google (Nano Banana Pro / Nano Banana), **revisables y aprobables dentro de la app**, guardados de forma ordenada en `outputs/`.

## 4. Objetivos secundarios

- Mantener **dos modos de autenticación**: API key (Gemini API) y ADC + Google Cloud Project ID (Vertex AI).
- Permitir **seleccionar el modelo de imagen** y la calidad desde Settings.
- Ofrecer **generación simulada** (placeholder PNG) para validar el flujo sin gastar créditos.
- Dar trazabilidad por carrusel mediante `metadata.json`.
- Permitir **regeneración granular** (slide individual) y total (carrusel completo) editando el prompt.
- Exportar PNGs de un carrusel y del lote aprobado.
- No exponer secretos en UI, logs ni metadata.

## 5. Alcance funcional inicial (MVP)

1. Importar y validar CSV de ideas.
2. Configurar autenticación, modelo, calidad, número de slides y modo simulado en Settings.
3. Dashboard operativo: tabla de ideas, filtros por estado, selección por checkbox y por rango.
4. Generación por lote de carruseles (simulada o real) con progreso, reintentos con backoff y cancelación de lote en curso.
5. Revisión en visor de slides con edición de prompt y regeneración (slide o carrusel).
6. Aprobación y cambio de estado de carruseles.
7. Exportación PNG (carrusel individual y lote aprobado).
8. Eliminación de un carrusel moviendo su carpeta a la papelera.

## 6. Límites explícitos del proyecto (fuera del MVP)

- **Exportación PDF** (storyboard / un slide por página): futura, no incluida.
- **Persistencia segura avanzada** (Keychain de macOS / cifrado de API key): futura; hoy se guarda en `settings.json` local y se enmascara en UI.
- **Base de datos** (SQLite): no; persistencia en JSON local.
- **Empaquetado/firmado/notarización** de la app: futuro.
- **Importar manual de marca**: prohibido por diseño; los lineamientos Academy son fijos y embebidos.
- **Soporte multi-idioma, versión web o móvil**: fuera de alcance.
- **Edición/composición local de texto sobre imagen** (pipeline alterno Canvas/HTML): solo riesgo registrado, no implementado.

## 7. Usuario objetivo y contexto de uso

- **Usuario principal:** operador de contenido/marketing clínico de Academy by Total Therapy, que trabaja con ideas **previamente validadas por una especialista médica**.
- **Contexto:** uso local en Mac, en sesiones de producción semanales/mensuales para preparar un lote de carruseles listos para revisión y publicación.
- **Nivel técnico:** medio; necesita una interfaz operativa clara, no una herramienta de desarrollador.

## 8. Stack tecnológico sugerido

- **Runtime/escritorio:** Electron 31 (proceso main + renderer).
- **Lenguaje:** JavaScript, módulos CommonJS.
- **UI:** HTML + CSS + JS sin framework; tipografía Poppins.
- **Red/IA:** `fetch` nativo de Node hacia Gemini API (`generativelanguage.googleapis.com`) o Vertex AI (`aiplatform.googleapis.com`).
- **Modelos de imagen:** `nano-banana-pro` (Gemini 3 Pro Image) y `nano-banana` (Gemini 2.5 Flash Image).
- **Persistencia:** archivos JSON locales en `outputs/state/`.
- **Gestor de paquetes:** npm. Script único: `npm start`.

## 9. Justificación del stack

- **Electron**: necesidad de acceso a filesystem local, diálogos nativos y ejecución offline para revisión; un solo lenguaje (JS) en main y renderer.
- **Sin framework UI**: el alcance es acotado y la interfaz es un dashboard con tablas/controles estándar; evita dependencias y superficie de mantenimiento.
- **JSON local**: suficiente para el volumen del MVP; SQLite se considera solo si el historial crece.
- **fetch nativo**: evita SDKs pesados; las APIs de Gemini/Vertex son REST y se invocan directamente.

## 10. Módulos principales previstos

1. **Datos / CSV**: parser, validación de columnas y estados, modelo de idea.
2. **Settings / Credenciales**: autenticación API key/ADC, selección de modelo, calidad, slides, modo simulado.
3. **Generación**: construcción de prompts por slide, llamada al modelo, reintentos, cancelación, escritura de PNG y `metadata.json`.
4. **Estado**: persistencia de ideas y carruseles, transiciones de estado.
5. **Revisión / UI**: dashboard, visor de carrusel, regeneración, aprobación.
6. **Exportación**: copia de PNGs aprobados a carpetas de entrega.

## 11. Flujo funcional general

```text
Importar CSV → validar → ideas en dashboard
   → seleccionar ideas (checkbox / rango)
   → generar lote (simulado o real) con progreso y cancelación
   → carruseles PNG + metadata.json en outputs/carruseles/
   → revisar slides → editar prompt → regenerar slide/carrusel
   → aprobar → exportar PNG (carrusel o lote aprobado)
```

## 12. Fases recomendadas del MVP

- **Fase 1 — Base técnica:** ventana Electron, preload seguro, persistencia JSON, estructura `outputs/`.
- **Fase 2 — Datos/CSV:** importación y validación de CSV; estados de idea.
- **Fase 3 — Settings/Credenciales:** autenticación API key/ADC, selección de modelo y parámetros.
- **Fase 4 — Generación:** prompts por slide, llamada real/simulada, reintentos, cancelación, metadata.
- **Fase 5 — Revisión/Regeneración:** visor, edición de prompt, regeneración granular y total, aprobación.
- **Fase 6 — Exportación:** PNG por carrusel y lote aprobado; abrir carpeta de salida.
- **Fase 7 — Pulido (hardening):** errores de API/rate limits, persistencia segura, pruebas de flujos clave.

> Nota: el repositorio ya implementa las Fases 1–6. El trabajo pendiente se concentra en la Fase 7. Ver detalle y estado en [TASK.md](TASK.md).

## 13. Entregables por fase

| Fase | Entregable verificable |
|------|------------------------|
| 1 | App levanta con `npm start`; carpetas `outputs/*` creadas; estado persistido en `outputs/state/`. |
| 2 | CSV válido se importa y lista ideas filtrables; CSV inválido se rechaza con error claro. |
| 3 | Settings guarda autenticación, modelo y parámetros; API key enmascarada; ADC detectada. |
| 4 | Una idea genera 4–5 PNGs + `metadata.json`; cancelación funciona; reintentos en errores recuperables. |
| 5 | Visor muestra slides; regenerar slide/carrusel actualiza la imagen; aprobación cambia estado. |
| 6 | Exportación copia PNGs de un carrusel y del lote aprobado a carpeta limpia. |
| 7 | Flujos clave probados; sin secretos en metadata; manejo robusto de errores de API. |

## 14. Riesgos iniciales

- **Legibilidad de texto en español** generado por el modelo en slides completos; mitigación: pipeline alterno (fondos IA + texto local) como backlog.
- **Disponibilidad/costo** de Nano Banana Pro según créditos y proveedor (Gemini API vs Vertex).
- **Rate limits / errores transitorios** de la API durante lotes grandes.
- **Seguridad de la API key** mientras no exista Keychain/cifrado.
- **Consistencia de marca**: que el modelo no aluciné logos; mitigado enviando logo/isotipo como referencia visual.

## 15. Criterios de éxito del MVP

- Importar un CSV válido y generar al menos un carrusel completo (4 o 5 slides) en `outputs/carruseles/...`.
- Revisar, regenerar un slide y aprobar ese carrusel dentro de la app.
- Exportar el lote aprobado a una carpeta limpia.
- No se filtran secretos en UI, logs ni `metadata.json`.
- La generación simulada permite recorrer todo el flujo sin consumir créditos.

## 16. Próximos documentos recomendados

1. [ARCHITECTURE.md](ARCHITECTURE.md) — estructura técnica y límites entre capas.
2. [SPEC.md](SPEC.md) — comportamiento verificable y criterios de aceptación.
3. [TASK.md](TASK.md) — fases y tareas pequeñas con validación.
4. [AGENTS.md](AGENTS.md) — reglas permanentes para agentes de IA.
5. [TESTING.md](TESTING.md) — estrategia y casos de prueba.
