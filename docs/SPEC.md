# SPEC.md — Academy Carousel Generator

> Documento SDD · Borrador inicial. Contrato funcional verificable del MVP.
> Coherente con [PLAN.md](PLAN.md) y [ARCHITECTURE.md](ARCHITECTURE.md). En conflicto, **este documento manda sobre el comportamiento**.

## 1. Alcance exacto del MVP

El sistema debe permitir, de forma local en macOS:

1. Importar un CSV de ideas válido y listarlo.
2. Configurar autenticación (API key o ADC), **modelo de imagen**, calidad, número de slides (4/5) y modo simulado.
3. Seleccionar ideas (individual y por rango) y generar un **lote de carruseles** (simulado o real).
4. Mostrar **progreso** por carrusel/slide, permitir **cancelar** el lote y registrar errores.
5. Revisar slides, **editar el prompt** y **regenerar** slide individual o carrusel completo.
6. Cambiar el estado del carrusel (incluida **aprobación**).
7. **Exportar** PNGs de un carrusel y del lote aprobado.
8. **Eliminar** un carrusel moviendo su carpeta a la papelera.

## 2. Exclusiones explícitas del MVP

- Exportación PDF.
- Keychain/cifrado de la API key.
- SQLite o base de datos.
- Empaquetado/firma/notarización.
- Importación de manual de marca (prohibido por diseño).
- Multi-idioma, versión web/móvil.
- Composición local de texto sobre imagen.

## 3. Actores o usuarios del sistema

- **Operador de contenido Academy** (único rol): importa, genera, revisa, aprueba y exporta.
- **Especialista médica** (externa a la app): valida las ideas antes del CSV. No interactúa con la app.

## 4. Supuestos operativos

- macOS con Node/Electron disponibles (`npm start`).
- Para generación real con ADC: Google Cloud SDK configurado y credencial en `~/.config/gcloud/application_default_credentials.json` (`type: authorized_user`), más un Project ID válido.
- Para generación real con API key: clave de Gemini API válida.
- Los assets `logo_color.png` e `isotipo_color.png` existen en `src/assets/academy/`.
- Las ideas del CSV ya están validadas clínicamente.

## 5. Entidades principales

**Idea**

```json
{
  "id": "1",
  "titulo": "Trigger Points: El mapa del dolor oculto",
  "concepto_clave": "...",
  "publico_objetivo": "Licenciados en Terapia Fisica",
  "capitulo_referencia": "Capitulo 2: ...",
  "pagina_referencia": "45-52",
  "sugerencia_visual": "...",
  "estado": "pendiente"
}
```

Columnas opcionales por slide de desarrollo: `slideN_concepto`, `slideN_visual`.

**Carrusel**

```json
{
  "ideaId": "1",
  "carouselId": "carrusel_001_trigger-points-...",
  "status": "generada",
  "slideCount": 4,
  "outputDir": "outputs/carruseles/carrusel_001_...",
  "slides": [{ "index": 1, "filename": "slide_01.png", "path": "...", "prompt": "...", "status": "generada", "generation": { } }],
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "errors": []
}
```

**Settings** (persistido): `authMode`, `apiKey`, `googleCloudProjectId`, `model`, `outputDir`, `slideCount`, `quality`, `maxCredits`, `retryDelayMs`, `maxRetries`, `simulateGeneration`.

## 6. Estados permitidos

- **Idea / carrusel:** `pendiente`, `generada`, `en_revision`, `aprobada`, `error`.
- **Transitorio de carrusel:** `cancelada` (tras cancelar un lote; la idea vuelve a `pendiente`).
- Transiciones válidas: `pendiente → generada → en_revision → aprobada`; cualquier estado → `error`; `generada/en_revision/aprobada → pendiente` al eliminar el carrusel.

## 7. Flujos funcionales principales

1. **Importar CSV.**
2. **Guardar settings.**
3. **Generar lote.**
4. **Cancelar lote.**
5. **Revisar y regenerar (slide / carrusel).**
6. **Aprobar / cambiar estado.**
7. **Exportar (carrusel / lote aprobado).**
8. **Eliminar carrusel.**

## 8. Entradas esperadas por flujo

| Flujo | Entradas |
|-------|----------|
| Importar CSV | archivo `.csv` con columnas obligatorias |
| Guardar settings | `authMode`, `apiKey`, `googleCloudProjectId`, `model`, `quality`, `slideCount`, `simulateGeneration` |
| Generar lote | `ideaIds[]`, `slideCount` |
| Cancelar lote | — (acción sobre el job activo) |
| Regenerar slide | `carouselId`, `slideIndex`, `prompt` |
| Regenerar carrusel | `ideaId`, `slideCount` |
| Cambiar estado | `carouselId`, `status` |
| Exportar carrusel | `carouselId` |
| Exportar lote | — |
| Eliminar | `carouselId` |

## 9. Salidas esperadas por flujo

| Flujo | Salida |
|-------|--------|
| Importar CSV | ideas listadas; copia en `outputs/ideas/ideas-YYYY-MM-DD.csv` |
| Guardar settings | settings públicos (API key enmascarada, `adcDetected`) |
| Generar lote | PNGs + `metadata.json` por carrusel; estados actualizados |
| Cancelar lote | lote detenido; estado parcial coherente; carruseles afectados `cancelada` |
| Regenerar slide | PNG del slide reemplazado; `metadata`/estado actualizados |
| Regenerar carrusel | carrusel regenerado completo |
| Cambiar estado | estado de carrusel e idea actualizados en `state.json` y `metadata.json` |
| Exportar | carpeta en `outputs/exports/...` con los PNGs |
| Eliminar | carpeta movida a papelera; idea vuelve a `pendiente` |

## 10. Reglas de negocio

- **RN-01** Solo se aceptan CSV con **todas** las columnas obligatorias; si falta alguna, se rechaza y **no** se altera el estado previo.
- **RN-02** Cada `estado` del CSV debe pertenecer al conjunto válido; si no, se rechaza indicando la fila.
- **RN-03** `slideCount` solo puede ser **4 o 5**.
- **RN-04** `model` solo puede ser `nano-banana-pro` o `nano-banana`; valor inválido → `nano-banana-pro`.
- **RN-05** El **primer slide** es portada: máximo ~8 palabras visibles, sin referencia bibliográfica.
- **RN-06** La **referencia capítulo/página** aparece **solo en el último slide** (en el resto, solo en metadata).
- **RN-07** Los slides de desarrollo deben tener gráficos **claramente distintos** entre sí y de la portada.
- **RN-08** Los lineamientos Academy se incluyen **siempre** en cada prompt; no se importan manuales externos.
- **RN-09** Si `simulateGeneration` está activo, se generan **placeholders PNG** sin llamar a la API.
- **RN-10** En modo real con ADC se requiere `googleCloudProjectId`; con API key se requiere `apiKey`.
- **RN-11** Errores recuperables se reintentan hasta `maxRetries` con backoff; los no recuperables se registran por slide.
- **RN-12** Eliminar un carrusel devuelve la idea a `pendiente`.

## 11. Validaciones obligatorias

- Columnas y estados del CSV (RN-01, RN-02).
- `slideCount ∈ {4,5}` y `model ∈ {nano-banana-pro, nano-banana}` al guardar settings.
- Credenciales presentes según `authMode` antes de generación real (RN-10).
- Existencia de carrusel/slide antes de regenerar.
- No iniciar un lote si ya hay uno activo (`generationJob.active`).

## 12. Contratos de datos

- **CSV obligatorio:** `id, titulo, concepto_clave, publico_objetivo, capitulo_referencia, pagina_referencia, sugerencia_visual, estado`.
- **`metadata.json`** debe incluir: idea original, prompts por slide, modelo (ID real), parámetros (`slideCount`, `quality`, `simulateGeneration`), fecha, estado, rutas de imágenes, `generationDetails` y `errors`. **Sin secretos.**
- **`state.json`:** `{ ideas, carousels, queue }`.

## 13. Contratos entre capas o interfaces

- El renderer solo se comunica con main mediante `window.academyAPI` (ver IPC en [ARCHITECTURE.md](ARCHITECTURE.md) §9).
- El evento `generation:progress` emite `{ carouselId, slideIndex, slideCount, status, error? }` y la UI lo refleja sin lógica de negocio.
- Las salidas que cruzan a renderer **nunca** contienen la API key real (siempre enmascarada).

## 14. Reglas de seguridad

- **RS-01** No exponer ni registrar secretos (UI, logs, metadata).
- **RS-02** API key enmascarada en todo lo que sale de main.
- **RS-03** Eliminar siempre a papelera (`shell.trashItem`), nunca borrado permanente directo.
- **RS-04** Mantener `contextIsolation: true`, `nodeIntegration: false`.
- **RS-05** ADC solo desde la ruta estándar y solo `type: authorized_user`.

## 15. Manejo de errores

- Mensajes de error **en español**, claros y accionables.
- CSV inválido: error específico (columna faltante o fila con estado inválido) sin corromper estado.
- Generación: reintento con backoff en errores recuperables; registro por slide en `errors[]`.
- Cancelación: estado parcial coherente; carrusel marcado `cancelada` e idea a `pendiente`.
- Falta de credenciales: error explícito antes de llamar a la API.

## 16. Criterios de aceptación por módulo

- **CSV/Datos:** importar CSV válido lista N ideas; CSV con columna faltante o estado inválido se rechaza con mensaje que identifica el problema; el estado previo no cambia.
- **Settings:** al guardar, la API key se enmascara; `slideCount` y `model` se normalizan; `adcDetected` refleja la realidad del sistema.
- **Generación:** una idea seleccionada produce `slideCount` PNGs y un `metadata.json` válido en `outputs/carruseles/<id>/`; en modo simulado no hay llamadas de red.
- **Cancelación:** al cancelar, el lote se detiene en el slide en curso y el estado queda coherente.
- **Revisión/Regeneración:** editar el prompt y regenerar reemplaza la imagen del slide; regenerar el carrusel rehace todos los slides.
- **Estado/Aprobación:** aprobar cambia el estado de carrusel e idea y se refleja en `state.json` y `metadata.json`.
- **Exportación:** exportar copia los PNGs correctos a `outputs/exports/...`.
- **Eliminación:** la carpeta va a la papelera y la idea vuelve a `pendiente`.

## 17. Casos de prueba funcionales

- **CP-01** Importar CSV válido → ideas visibles y filtrables.
- **CP-02** Importar CSV sin columna `estado` → error claro; estado intacto.
- **CP-03** CSV con `estado` inválido en una fila → error que indica el número de fila.
- **CP-04** Guardar settings con `model` inválido → se persiste `nano-banana-pro`.
- **CP-05** Generar (simulado) una idea con 4 slides → 4 PNGs + metadata.
- **CP-06** Generar (simulado) con 5 slides → 5 PNGs.
- **CP-07** Cancelar un lote en curso → carruseles afectados `cancelada`, ideas a `pendiente`.
- **CP-08** Regenerar un slide con prompt editado → PNG actualizado, `updatedAt` cambia.
- **CP-09** Aprobar carrusel → estado `aprobada` en state y metadata.
- **CP-10** Exportar lote aprobado → carpeta `lote_aprobado_YYYY-MM-DD` con los carruseles aprobados.
- **CP-11** Eliminar carrusel → carpeta en papelera, idea `pendiente`.
- **CP-12** (Real, opcional) `node scripts/verify-vertex-image.js` con ADC válido → genera imagen de prueba.

## 18. Casos borde

- CSV vacío → error "El CSV esta vacio".
- CSV con celdas con comas/comillas escapadas → parseo correcto.
- Idea sin `slideN_concepto/visual` → cae al concepto/visual global (compatibilidad).
- Reintentar mientras se cancela → prevalece la cancelación.
- Iniciar lote con uno ya activo → error "Ya hay una generacion en curso".
- Exportar lote sin aprobados → `count: 0` y carpeta vacía.
- API key entrante `********` → se conserva la previa.

## 19. Definición de terminado del MVP

El MVP está terminado cuando:

- CP-01 a CP-11 pasan en modo simulado.
- Al menos un carrusel se genera en modo **real** (CP-12 o flujo equivalente) sin filtrar secretos.
- No hay secretos en UI, logs ni `metadata.json`.
- `npm start` levanta la app sin errores de consola en el flujo feliz.
- La documentación SDD queda coherente con el comportamiento implementado.

## 20. Backlog futuro fuera del MVP

- Exportación PDF (storyboard / un slide por página).
- Persistencia segura de API key (Keychain/cifrado).
- SQLite si crece el historial.
- Pipeline alterno de composición de texto local.
- `generation-log.jsonl` de auditoría.
- Empaquetado/firma macOS.
