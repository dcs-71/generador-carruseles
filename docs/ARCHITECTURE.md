# ARCHITECTURE.md — Academy Carousel Generator

> Documento SDD · Borrador inicial. Coherente con [PLAN.md](PLAN.md).
> Define cómo se organiza técnicamente el proyecto para que un agente o desarrollador implemente sin improvisar estructura ni responsabilidades.

## 1. Resumen arquitectónico

Aplicación Electron de un solo proceso de ventana, con separación estricta **main / preload / renderer**:

- **Main** (Node): filesystem, persistencia, autenticación, llamadas a la API de imagen, cola de generación, exportación.
- **Preload**: puente seguro vía `contextBridge` que expone solo funciones IPC necesarias.
- **Renderer**: UI sin framework (HTML/CSS/JS) que nunca accede a Node ni a la red directamente; todo pasa por IPC.

## 2. Principios de arquitectura

- **El renderer no toca el sistema ni la red.** Toda operación sensible vive en main y se invoca por IPC.
- **`contextIsolation: true`, `nodeIntegration: false`.** El preload define la única superficie expuesta.
- **Determinismo de prompts.** La construcción de prompts es pura y reproducible a partir de la idea.
- **Estado como fuente de verdad en JSON.** El estado vive en disco y se reescribe tras cada cambio relevante.
- **Cambios pequeños y reversibles.** Una responsabilidad por función; sin acoplar capas.
- **Marca Academy embebida y no negociable.** Los lineamientos van en el prompt; no se importan manuales externos.

## 3. Stack tecnológico definitivo

- Electron 31 · Node integrado.
- JavaScript CommonJS (`require` / `module.exports`).
- Renderer: HTML + CSS + JS plano; fuente Poppins.
- `fetch` nativo de Node para Gemini API y Vertex AI.
- Persistencia: archivos JSON en `outputs/state/`.
- npm; script único `npm start`.

## 4. Estructura de carpetas propuesta

```text
.
├── package.json            # script "start": electron .
├── src/
│   ├── main/
│   │   ├── main.js         # proceso principal, IPC, generación, persistencia
│   │   └── preload.js      # puente contextBridge (academyAPI)
│   ├── renderer/
│   │   ├── index.html      # dashboard, revisión, settings
│   │   ├── renderer.js     # estado de UI y handlers
│   │   └── styles.css      # estilos Academy
│   └── assets/
│       └── academy/        # logo_color.png, isotipo_color.png (referencia visual)
├── scripts/
│   └── verify-vertex-image.js   # verificador de conexión real a Vertex (ADC)
├── outputs/                # salida y estado (no versionar generados)
│   ├── ideas/
│   ├── carruseles/
│   ├── exports/
│   └── state/             # state.json, settings.json
└── docs/                   # documentación (incl. docs/sdd/)
```

## 5. Separación de capas

| Capa | Ubicación | Acceso permitido |
|------|-----------|------------------|
| Main / orquestación | `src/main/main.js` | filesystem, red, `dialog`, `shell`, IPC handlers |
| Puente IPC | `src/main/preload.js` | solo `ipcRenderer.invoke/on` expuestos por `contextBridge` |
| Presentación | `src/renderer/*` | DOM y `window.academyAPI`; **sin** Node ni `fetch` a la API |

## 6. Responsabilidades de cada capa

- **Main:** validar/parsear CSV, construir prompts, autenticar (API key/ADC), llamar al modelo, reintentar, cancelar, escribir PNG y `metadata.json`, persistir `state.json`/`settings.json`, exportar, mover a papelera.
- **Preload:** declarar el contrato `academyAPI` (un método por canal IPC); no contiene lógica de negocio.
- **Renderer:** render del dashboard/visor/settings, manejo de selección y filtros, disparar acciones vía `academyAPI`, mostrar progreso y toasts. No decide reglas de negocio.

## 7. Módulos principales del sistema

1. **CSV/Datos** — `parseCsv`, columnas requeridas, estados válidos.
2. **Settings** — carga/guardado, enmascarado de API key, detección ADC, validación de modelo.
3. **Prompts** — `academyPrompt`, `slidePlan`, lineamientos Academy, reglas por rol de slide.
4. **Generación** — `writeGeneratedImage`, `withGenerationRetries`, `createPlaceholderPng`, cola `generationJob`.
5. **Estado** — `state` (ideas, carruseles), `saveState`, transiciones.
6. **Exportación** — `export:carousel`, `export:approvedBatch`.

## 8. Flujo de datos entre módulos

```text
CSV → parseCsv → state.ideas → (UI selección)
   → generation:startBatch → academyPrompt → writeGeneratedImage / placeholder
   → PNG + metadata.json en outputs/carruseles/<id>/
   → state.carousels (status) → saveState
   → UI revisión → regenerate* → metadata/state actualizados
   → export:* → outputs/exports/<destino>/
```

## 9. Contratos técnicos entre capas (IPC)

Canales `ipcMain.handle` ↔ `academyAPI`:

| Canal | Entrada | Salida |
|-------|---------|--------|
| `app:initialData` | — | `{ ideas, carousels, settings }` |
| `ideas:importCsv` | — | `{ ideas, copiedTo }` o `{ canceled }` |
| `settings:save` | settings parciales | settings públicos (API key enmascarada) |
| `generation:startBatch` | `{ ideaIds, slideCount }` | `{ carousels, ideas, cancelled }` |
| `generation:cancel` | — | `{ cancelled, message? }` |
| `generation:regenerateSlide` | `{ carouselId, slideIndex, prompt }` | carrusel actualizado |
| `generation:regenerateCarousel` | `{ ideaId, slideCount }` | carrusel actualizado |
| `carousel:updateStatus` | `{ carouselId, status }` | `{ carousel, ideas }` |
| `carousel:delete` | `{ carouselId }` | `{ deletedCarouselId, ideas, carousels }` |
| `export:carousel` | `{ carouselId }` | `{ dest }` |
| `export:approvedBatch` | — | `{ count, dest }` |
| `shell:openPath` | ruta | resultado de `shell.openPath` |
| `generation:progress` *(evento main→renderer)* | — | `{ ideaId?, carouselId, slideIndex, slideCount, status, error? }` |

> Convención obligatoria: nombres IPC con prefijo de dominio (`ideas:*`, `settings:*`, `generation:*`, `carousel:*`, `export:*`, `shell:*`).

## 10. Modelo de persistencia o almacenamiento

- **`outputs/state/state.json`**: `{ ideas: [], carousels: [], queue: [] }`.
- **`outputs/state/settings.json`**: configuración persistida (incluye API key en claro en disco local; nunca se versiona ni se expone en UI).
- **`outputs/carruseles/<carouselId>/metadata.json`**: idea original, prompts por slide, modelo, parámetros, fecha, estado, rutas de imágenes, detalles de generación y errores.
- **PNGs**: `slide_01.png` … `slide_05.png` por carrusel.
- Escritura atómica conceptual: reescribir el JSON completo tras cada cambio relevante (`saveState`, `metadata.json` tras cada slide).

## 11. Manejo de configuración

- Settings por defecto definidos en main; se fusionan con `settings.json` al iniciar (`{ ...defaults, ...stored }`).
- `settings:save` normaliza: `slideCount ∈ {4,5}`; `model ∈ {nano-banana-pro, nano-banana}` (fallback a `nano-banana-pro`); si la API key entrante es `********` se conserva la existente.
- `publicSettings()` enmascara la API key y añade `adcDetected`.
- El modelo lógico se traduce al ID real por proveedor en `modelForProvider(model, provider)`.

## 12. Manejo de errores

- **CSV inválido:** lanzar error descriptivo en español; no corromper el estado previo.
- **Generación:** clasificar errores recuperables (`429`, `500`, `503`, `quota`, `fetch failed`, etc.) → reintentar con backoff (`retryDelayMs * intento`, hasta `maxRetries`).
- **Cancelación:** `generationJob.cancelled` + `AbortController`; se propaga como `GENERATION_CANCELLED` y deja estado parcial coherente.
- **Errores por slide:** se registran en `errors[]` del carrusel/metadata sin abortar todo el lote salvo cancelación.
- La UI muestra los mensajes vía `toast`.

## 13. Seguridad y validaciones técnicas

- `contextIsolation: true`, `nodeIntegration: false`, preload mínimo.
- **Nunca** imprimir, exponer ni guardar secretos en UI, logs ni `metadata.json`.
- API key enmascarada en todo lo que sale de main.
- ADC se lee solo desde `~/.config/gcloud/application_default_credentials.json`; solo se soporta `type: authorized_user`.
- Validación de columnas y estados del CSV antes de aceptar datos.
- Sanitizar nombres de carpeta con `slugify`.
- Eliminación de carruseles vía `shell.trashItem` (papelera), nunca borrado permanente directo.

## 14. Convenciones de nombres

- **Carruseles:** `carrusel_<NNN>_<slug-titulo>`.
- **Slides:** `slide_<NN>.png` (dos dígitos).
- **Exports:** `outputs/exports/lote_aprobado_YYYY-MM-DD/` y `outputs/exports/<carouselId>/`.
- **IDs lógicos de modelo:** `nano-banana-pro`, `nano-banana` (no IDs crudos de API en UI).
- **Canales IPC:** `dominio:accion`.

## 15. Convenciones de código

- CommonJS; funciones pequeñas y puras donde sea posible.
- Strings de usuario en español.
- Sin dependencias nuevas salvo justificación explícita.
- Comentarios solo donde aclaran intención no obvia (p. ej. lógica de `slidePlan`).
- Mantener el estilo del archivo circundante (naming, densidad de comentarios, idioma).

## 16. Dependencias permitidas y a evitar

- **Permitidas:** `electron` (única dependencia de runtime). Node estándar (`fs`, `path`, `zlib`, `fetch`).
- **A evitar (sin aprobación):** frameworks UI (React/Vue), ORMs/SQLite, SDKs de Google, librerías de imagen pesadas, empaquetadores. Cualquier alta debe justificarse por necesidad real del MVP.

## 17. Puntos de extensión futura

- Exportación PDF (storyboard / un slide por página).
- Persistencia segura de API key (Keychain macOS / cifrado).
- Migración a SQLite si el historial crece.
- Pipeline alterno: fondos/ilustraciones por IA + composición de texto local (Canvas/HTML).
- Empaquetado y firma para distribución macOS.
- Registro `generation-log.jsonl` para auditoría.

## 18. Decisiones técnicas importantes

- **JSON local sobre SQLite** para el MVP (simplicidad; revisable si crece el historial).
- **fetch directo sobre SDK** (menos dependencias, control del endpoint Gemini/Vertex).
- **Modelo lógico + `modelForProvider`** para desacoplar la elección del usuario del ID real por proveedor.
- **Logo/isotipo como referencia visual** enviada al modelo para evitar logos alucinados.
- **Generación simulada por defecto** para validar flujo sin costo.
- **Referencia capítulo/página solo en el último slide** (regla de producto en el prompt).

## 19. Riesgos arquitectónicos

- Crecimiento de `main.js` como módulo monolítico; mitigar extrayendo módulos (`csv`, `prompts`, `generation`, `settings`) si supera un umbral razonable.
- Reescritura completa de JSON en cada cambio: aceptable para el volumen actual; riesgo si el historial crece mucho.
- Acoplamiento UI↔shape de datos del main; mantener el contrato IPC estable.
- API key en claro en disco hasta implementar almacenamiento seguro.

## 20. Reglas que la IA debe respetar al implementar

1. No mover lógica de red/filesystem al renderer; todo pasa por IPC.
2. No agregar dependencias sin justificación y aprobación.
3. No romper los contratos IPC de la sección 9 sin actualizar preload, renderer y este documento.
4. No exponer ni registrar secretos en ningún punto.
5. Respetar nombres de carpetas/archivos y prefijos IPC.
6. No introducir funcionalidades fuera del MVP definido en [SPEC.md](SPEC.md).
7. Conservar `contextIsolation: true` y `nodeIntegration: false`.
8. Guardar estado tras cada cambio relevante y mantener `metadata.json` coherente.
