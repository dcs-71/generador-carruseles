# TESTING.md — Academy Carousel Generator

> Documento SDD · Borrador inicial. Cómo se comprueba que el MVP funciona y respeta las reglas críticas.
> Coherente con [SPEC.md](SPEC.md) (casos CP-xx, reglas RN-xx/RS-xx), [ARCHITECTURE.md](ARCHITECTURE.md) y [TASK.md](TASK.md).

## 1. Estrategia general de pruebas

El MVP se valida principalmente con **pruebas funcionales manuales** sobre la app Electron, apoyadas por **chequeo de sintaxis** (`node --check`) y un **verificador de generación real** (`scripts/verify-vertex-image.js`). Aún no hay framework de tests automatizados; se prioriza recorrer flujos completos en modo **simulado** (sin costo) y validar al menos un flujo **real**.

## 2. Alcance de pruebas del MVP

Se prueban: importación/validación de CSV, settings y selección de modelo, generación simulada y real, progreso/cancelación, revisión/regeneración, cambios de estado/aprobación, exportación y eliminación. **Fuera de alcance:** PDF, Keychain, SQLite, empaquetado.

## 3. Pruebas unitarias recomendadas (futuras)

Funciones puras candidatas a test cuando se agregue un runner: `parseCsv`, `slugify`, `carouselIdForIdea`, `slidePlan`, `modelForProvider`, `isRetryableGenerationError`, `publicSettings` (enmascarado). Hoy se verifican indirectamente vía flujos manuales.

## 4. Pruebas de integración recomendadas

- IPC `ideas:importCsv` → estado `ideas` poblado.
- `generation:startBatch` (simulado) → PNGs + `metadata.json` en disco.
- `carousel:updateStatus` → coherencia entre `state.json`, idea y `metadata.json`.
- `export:approvedBatch` → archivos copiados a `outputs/exports/`.

## 5. Pruebas funcionales manuales

Ejecutar `npm start` y recorrer:

1. Importar CSV válido → ideas visibles y filtrables (CP-01).
2. Importar CSV inválido (columna faltante / estado inválido) → error claro, estado intacto (CP-02, CP-03).
3. Settings: guardar, reabrir, ver API key enmascarada y modelo elegido (CP-04).
4. Generar (simulado) 4 y 5 slides (CP-05, CP-06).
5. Iniciar lote y cancelar (CP-07).
6. Revisar, editar prompt y regenerar slide (CP-08).
7. Aprobar carrusel (CP-09).
8. Exportar lote aprobado (CP-10).
9. Eliminar carrusel (CP-11).

## 6. Pruebas de seguridad

- **PS-01** Inspeccionar `metadata.json` → **sin** API key ni tokens (RS-01).
- **PS-02** `outputs/state/settings.json` no se versiona; UI nunca muestra la clave en claro (RS-02).
- **PS-03** Eliminar carrusel mueve a **papelera**, no borra permanentemente (RS-03).
- **PS-04** Confirmar `contextIsolation: true` y `nodeIntegration: false` (RS-04).
- **PS-05** ADC solo se lee de la ruta estándar y `type: authorized_user` (RS-05).

## 7. Pruebas de regresión

Tras cualquier cambio, re-ejecutar CP-01…CP-11 en modo simulado y PS-01…PS-05. Cambios en generación o IPC exigen además un flujo real mínimo (sección 12 / CP-12).

## 8. Casos borde

- CSV vacío → error "El CSV esta vacio".
- CSV con comas/comillas escapadas → parseo correcto.
- Idea sin `slideN_concepto/visual` → cae al global.
- Cancelar mientras reintenta → prevalece la cancelación.
- Lote con otro lote activo → error "Ya hay una generacion en curso".
- Exportar lote sin aprobados → `count: 0`.
- API key entrante `********` → conserva la previa.

## 9. Datos de prueba sugeridos

- CSV mínimo de 2–3 ideas con todas las columnas obligatorias y estados `pendiente`.
- Una variante con columna `estado` ausente (para CP-02).
- Una variante con un `estado` inválido en la fila 2 (para CP-03).
- Idea con `slide2_concepto`/`slide2_visual` para verificar variedad de slides de desarrollo.

## 10. Comandos de validación

```bash
npm install                          # dependencias
npm start                            # levantar la app
node --check src/main/main.js        # sintaxis main
node --check src/main/preload.js     # sintaxis preload
node --check src/renderer/renderer.js# sintaxis renderer
node scripts/verify-vertex-image.js  # generación real de prueba (ADC)
```

## 11. Checklist antes de merge

- [ ] CP-01…CP-11 pasan en modo simulado.
- [ ] PS-01…PS-05 verificados.
- [ ] `node --check` sin errores en los archivos tocados.
- [ ] `npm start` sin errores de consola en el flujo feliz.
- [ ] Sin dependencias nuevas injustificadas.
- [ ] Documentación SDD coherente si cambió un contrato/decisión.

## 12. Checklist antes de release

- [ ] Al menos un carrusel generado en modo **real** sin filtrar secretos (CP-12).
- [ ] Revisión visual: sin desbordes de texto en mobile/desktop; botones principales funcionan.
- [ ] `outputs/carruseles/...` contiene PNGs y `metadata.json` válidos.
- [ ] Manejo de errores de API verificado (rate limit / fallo recuperable).
- [ ] Estado persistente correcto tras reiniciar la app.

## 13. Casos de prueba por módulo

| Módulo | Casos |
|--------|-------|
| CSV/Datos | CP-01, CP-02, CP-03, casos borde de parseo |
| Settings | CP-04, PS-01, PS-02 |
| Generación | CP-05, CP-06, CP-12, reintentos/backoff |
| Cola/Cancelación | CP-07 |
| Revisión/Regeneración | CP-08 |
| Estado/Aprobación | CP-09 |
| Exportación | CP-10 |
| Eliminación | CP-11, PS-03 |

## 14. Resultado esperado por caso

| Caso | Resultado esperado |
|------|--------------------|
| CP-01 | N ideas listadas; copia en `outputs/ideas/` |
| CP-02 | Error que nombra la columna faltante; estado intacto |
| CP-03 | Error que indica la fila con estado inválido |
| CP-04 | `model` inválido persiste como `nano-banana-pro` |
| CP-05 | 4 PNGs + `metadata.json` |
| CP-06 | 5 PNGs |
| CP-07 | Lote detenido; carruseles `cancelada`; ideas `pendiente` |
| CP-08 | PNG del slide reemplazado; `updatedAt` cambia |
| CP-09 | Estado `aprobada` en `state.json` y `metadata.json` |
| CP-10 | Carpeta `lote_aprobado_YYYY-MM-DD` con los aprobados |
| CP-11 | Carpeta en papelera; idea `pendiente` |
| CP-12 | Imagen real generada; sin secretos en metadata |

## 15. Severidad de errores

- **Crítico:** fuga de secretos, borrado permanente no deseado, corrupción de estado, app no levanta.
- **Alto:** un flujo principal (CP-xx) falla; generación real falla con credenciales válidas.
- **Medio:** error de UI no bloqueante; mensaje poco claro; caso borde mal manejado.
- **Bajo:** cosmético, copy, detalle visual.

## 16. Criterios para aprobar una fase

- Todos los casos de la fase pasan con su resultado esperado.
- Sin hallazgos **Críticos** ni **Altos** abiertos.
- Validaciones de la sección 10 ejecutadas en los archivos tocados.
- Sin alcance fuera del MVP ni dependencias injustificadas.

## 17. Criterios para bloquear una fase

- Cualquier hallazgo **Crítico**.
- Fuga de secretos (PS-01/PS-02).
- Borrado permanente en vez de papelera (PS-03).
- Un caso principal (CP-xx) de la fase no pasa.

## 18. Evidencias mínimas que debe reportar la IA

- Comandos ejecutados y su resultado (incluido `node --check`).
- Lista de PNGs/carpetas generadas y ruta.
- Extracto **no sensible** de `metadata.json` (sin secretos).
- Casos CP/PS probados y su veredicto.
- Hallazgos con severidad.

## 19. Validaciones que deben repetirse en cada ciclo

- `node --check` de los archivos modificados.
- `npm start` y recorrido del flujo afectado.
- PS-01 (sin secretos en metadata) siempre que se toque generación o settings.
- Re-test de los CP-xx del módulo afectado.

## 20. Recomendaciones para automatización futura

- Agregar un runner ligero (p. ej. `node --test`) para las funciones puras de la sección 3.
- Scripts npm `test`, `lint` y `typecheck` (con migración opcional a TypeScript) como deuda técnica.
- Fixtures de CSV en `test/fixtures/` para CP-01…CP-03.
- Mock del `fetch` de generación para probar reintentos/cancelación sin red.
- Smoke test de arranque de Electron en CI.
