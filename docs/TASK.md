# TASK.md — Academy Carousel Generator

> Documento SDD · Borrador inicial. Plan de implementación en tareas pequeñas y verificables.
> Coherente con [PLAN.md](PLAN.md), [ARCHITECTURE.md](ARCHITECTURE.md) y [SPEC.md](SPEC.md).
> El repositorio ya implementa las Fases 1–6; sirven además como **checklist de regresión**. El trabajo abierto está en la Fase 7.

## 1. Convención general de trabajo

- Trabajar por **ciclos**: leer la tarea → explicar el plan en 2–3 líneas → implementar **solo** esa tarea → validar → reportar.
- Una tarea no está terminada hasta que **pasa su validación** y **respeta la arquitectura**.
- No introducir alcance fuera del MVP de [SPEC.md](SPEC.md).
- Mensajes de usuario en español. Sin secretos en código, logs ni metadata.

## 2. Regla de 1 a 3 tareas por ciclo

- **1 tarea por ciclo** (obligatorio) cuando toca: generación real / red, credenciales, IPC, persistencia de estado, eliminación a papelera o exportación.
- **Hasta 3 tareas por ciclo** solo si son **simples, secuenciales, reversibles** y de bajo riesgo (UI, copy, estilos, documentación).
- Si una tarea bloquea a la siguiente, **detenerse y reportar** el bloqueo.

## 3. Fases de implementación del MVP

1. Base técnica · 2. Datos/CSV · 3. Settings/Credenciales · 4. Generación · 5. Revisión/Regeneración · 6. Exportación · 7. Pulido (hardening).

## 4. Tareas por fase

### Fase 1 — Base técnica

**Tarea 1.1 — Ventana y preload seguro**
- Objetivo: levantar Electron con `contextIsolation: true`, `nodeIntegration: false` y preload mínimo.
- Archivos: `src/main/main.js`, `src/main/preload.js`, `package.json`.
- Criterios de aceptación: `npm start` abre la ventana; el renderer accede solo a `window.academyAPI`.
- Validación: `npm start`; `node --check src/main/main.js`; `node --check src/main/preload.js`.
- Riesgo: Medio.

**Tarea 1.2 — Estructura de salida y persistencia JSON**
- Objetivo: crear `outputs/{ideas,carruseles,exports,state}` y cargar/guardar `state.json`/`settings.json`.
- Archivos: `src/main/main.js`.
- Criterios: al iniciar existen las carpetas; el estado persiste entre ejecuciones.
- Validación: `npm start`; inspeccionar `outputs/state/`.
- Riesgo: Bajo.

### Fase 2 — Datos/CSV

**Tarea 2.1 — Parser y validación de CSV**
- Objetivo: parsear CSV (comillas/comas escapadas), validar columnas obligatorias y estados.
- Archivos: `src/main/main.js`.
- Criterios: CSV válido → ideas; faltante de columna o estado inválido → error claro; estado previo intacto (RN-01, RN-02).
- Validación: `npm start` + importar CSV válido e inválido; `node --check src/main/main.js`.
- Riesgo: Medio.

**Tarea 2.2 — Render de ideas, filtros y selección**
- Objetivo: tabla de ideas con filtros por estado, selección por checkbox y por rango.
- Archivos: `src/renderer/index.html`, `src/renderer/renderer.js`, `src/renderer/styles.css`.
- Criterios: CP-01 visible; rango `1-7` selecciona correctamente.
- Validación: `npm start`; `node --check src/renderer/renderer.js`.
- Riesgo: Bajo.

### Fase 3 — Settings/Credenciales

**Tarea 3.1 — Persistencia y enmascarado de settings**
- Objetivo: guardar settings; enmascarar API key; detectar ADC; normalizar `slideCount` y `model`.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`, `src/renderer/index.html`.
- Criterios: API key sale enmascarada; `model` inválido → `nano-banana-pro`; `adcDetected` correcto.
- Validación: `npm start` + guardar settings y reabrir; revisar `outputs/state/settings.json`.
- Riesgo: **Alto** (credenciales) → 1 tarea por ciclo.

**Tarea 3.2 — Selección de modelo de imagen**
- Objetivo: desplegable de modelo (`nano-banana-pro`, `nano-banana`) en Settings, validado en main.
- Archivos: `src/renderer/index.html`, `src/renderer/renderer.js`, `src/main/main.js`.
- Criterios: CP-04; el modelo elegido persiste y aparece en `metadata.json` (ID real vía `modelForProvider`).
- Validación: `npm start`; `node --check` de los archivos tocados.
- Riesgo: Bajo. *(Ya implementado — usar como verificación.)*

### Fase 4 — Generación

**Tarea 4.1 — Generador de prompts por slide**
- Objetivo: `academyPrompt`/`slidePlan` con reglas de portada, último slide y variedad (RN-05–RN-08).
- Archivos: `src/main/main.js`.
- Criterios: portada sin referencia; referencia solo en último slide; lineamientos Academy siempre presentes.
- Validación: `node --check src/main/main.js`; revisar prompts en `metadata.json` tras generar.
- Riesgo: Bajo.

**Tarea 4.2 — Generación simulada (placeholders)**
- Objetivo: `createPlaceholderPng` y rama `simulateGeneration`.
- Archivos: `src/main/main.js`.
- Criterios: CP-05/CP-06 sin llamadas de red.
- Validación: `npm start` + generar en modo simulado; verificar PNGs.
- Riesgo: Bajo.

**Tarea 4.3 — Generación real (Gemini API / Vertex)**
- Objetivo: `writeGeneratedImage` con selección de proveedor, headers, `imageConfig` y referencia visual de marca.
- Archivos: `src/main/main.js`.
- Criterios: con credenciales válidas, una idea genera PNGs reales; sin secretos en metadata (RN-10, RS-01).
- Validación: `node scripts/verify-vertex-image.js` (ADC); generación real de una idea.
- Riesgo: **Alto** → 1 tarea por ciclo.

**Tarea 4.4 — Reintentos, cancelación y cola de progreso**
- Objetivo: `withGenerationRetries` (backoff), `AbortController`, evento `generation:progress`.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`.
- Criterios: CP-07; reintenta solo errores recuperables; cancelar deja estado coherente (RN-11).
- Validación: `npm start` + iniciar y cancelar un lote.
- Riesgo: **Alto** → 1 tarea por ciclo.

### Fase 5 — Revisión/Regeneración

**Tarea 5.1 — Visor de carrusel**
- Objetivo: visor con navegación, miniaturas, metadata y prompt del slide.
- Archivos: `src/renderer/*`.
- Criterios: se ve cada slide; el prompt mostrado corresponde al slide.
- Validación: `npm start` + abrir un carrusel generado.
- Riesgo: Bajo.

**Tarea 5.2 — Regeneración de slide y de carrusel**
- Objetivo: `generation:regenerateSlide` / `regenerateCarousel` con prompt editable.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`.
- Criterios: CP-08; regenerar carrusel rehace todos los slides.
- Validación: `npm start` + regenerar; verificar `updatedAt` y PNG.
- Riesgo: Medio.

**Tarea 5.3 — Cambio de estado y aprobación**
- Objetivo: `carousel:updateStatus`; sincronizar idea↔carrusel y `metadata.json`.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`.
- Criterios: CP-09.
- Validación: `npm start` + aprobar; revisar `state.json`/`metadata.json`.
- Riesgo: Medio.

### Fase 6 — Exportación

**Tarea 6.1 — Exportar carrusel y lote aprobado**
- Objetivo: `export:carousel` y `export:approvedBatch` a `outputs/exports/...`.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`.
- Criterios: CP-10; nombres ordenados.
- Validación: `npm start` + exportar; verificar carpetas.
- Riesgo: Medio.

**Tarea 6.2 — Eliminar carrusel a papelera**
- Objetivo: `carousel:delete` con `shell.trashItem`; idea vuelve a `pendiente`.
- Archivos: `src/main/main.js`, `src/renderer/renderer.js`.
- Criterios: CP-11 (RN-12, RS-03).
- Validación: `npm start` + eliminar; confirmar papelera.
- Riesgo: **Alto** (destructivo) → 1 tarea por ciclo.

### Fase 7 — Pulido (hardening) · trabajo abierto

**Tarea 7.1 — Robustez de errores de API / rate limits**
- Objetivo: mensajes claros y backoff ante `429/500/503/quota`.
- Validación: simular fallos; revisar `errors[]` en metadata.
- Riesgo: Medio.

**Tarea 7.2 — Persistencia segura de API key (Keychain/cifrado)**
- Objetivo: dejar de guardar la clave en claro en `settings.json`.
- Validación: confirmar que la clave no queda legible en disco; UI sigue enmascarando.
- Riesgo: **Alto** → 1 tarea por ciclo.

**Tarea 7.3 — Pruebas guiadas de flujos clave**
- Objetivo: ejecutar y documentar CP-01…CP-11 según [TESTING.md](TESTING.md).
- Validación: checklist de TESTING completo.
- Riesgo: Bajo.

## 5. Dependencias entre tareas

- 1.1 → 1.2 → (2.1 → 2.2) → (3.1 → 3.2) → (4.1 → 4.2 → 4.3 → 4.4) → (5.1 → 5.2 → 5.3) → (6.1, 6.2) → Fase 7.
- 4.3 depende de 3.1 (credenciales). 4.4 depende de 4.2/4.3. 5.2 depende de 4.x. 6.1 depende de 5.3.

## 6. Objetivo de cada tarea

Definido en la línea **Objetivo** de cada tarea (sección 4). Cada objetivo es único y verificable.

## 7. Archivos esperados por tarea

Definidos en la línea **Archivos** de cada tarea. No tocar archivos fuera de los listados sin justificarlo.

## 8. Criterios de aceptación por tarea

Definidos en la línea **Criterios** de cada tarea, referenciando reglas (RN-xx/RS-xx) y casos (CP-xx) de [SPEC.md](SPEC.md).

## 9. Comandos de validación por tarea

Definidos en la línea **Validación**. Comandos reales disponibles:

- `npm install` · `npm start`
- `node --check <archivo.js>` (chequeo de sintaxis)
- `node scripts/verify-vertex-image.js` (conexión real a Vertex con ADC)
- QA manual de flujos (ver [TESTING.md](TESTING.md)).

> No existen aún `typecheck`, `lint`, `test` ni `build`. Agregarlos es backlog (ver Fase 7 / TESTING §20). No inventar comandos inexistentes.

## 10. Riesgo de cada tarea

Indicado por tarea (Bajo/Medio/Alto). Toda tarea **Alta** se ejecuta sola por ciclo y exige revisión humana antes de commit.

## 11. Recomendación de rama Git por fase

> El repositorio actual **no** tiene control Git inicializado. Si se decide versionar, usar una rama por fase:

- `feat/base-tecnica` · `feat/datos-csv` · `feat/settings-credenciales`
- `feat/generacion` · `feat/revision-regeneracion` · `feat/exportacion`
- `chore/hardening`

## 12. Mensaje de commit sugerido por fase

- Fase 1: `feat: base electron y persistencia json`
- Fase 2: `feat: importacion y validacion de csv`
- Fase 3: `feat: settings, credenciales y seleccion de modelo`
- Fase 4: `feat: generacion de carruseles (simulada y real)`
- Fase 5: `feat: revision y regeneracion de slides`
- Fase 6: `feat: exportacion y eliminacion de carruseles`
- Fase 7: `chore: hardening de errores y seguridad`

## 13. Qué no debe hacerse en cada fase

- No mover lógica de red/filesystem al renderer (todas las fases).
- No agregar dependencias sin justificación (todas).
- No exponer secretos (todas; crítico en 3.x y 4.3).
- No agregar PDF, SQLite, Keychain ni empaquetado dentro del MVP.
- No agrupar tareas Altas con otras (4.3, 4.4, 6.2, 7.2 van solas).
- No borrar carpetas de forma permanente; usar papelera.

## 14. Checklist de cierre por fase

- [ ] La tarea cumple su criterio de aceptación y el SPEC.
- [ ] Validación ejecutada y en verde.
- [ ] Sin lógica en capas equivocadas.
- [ ] Sin alcance extra ni dependencias nuevas injustificadas.
- [ ] Sin secretos en código/logs/metadata.
- [ ] Documentación SDD actualizada si cambió una decisión o contrato.
- [ ] (Si aplica) commit con mensaje según convención.

## 15. Orden recomendado para implementar

1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 4.2 → 4.3 → 4.4 → 5.1 → 5.2 → 5.3 → 6.1 → 6.2 → 7.1 → 7.2 → 7.3.
