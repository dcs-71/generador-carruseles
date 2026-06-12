# AGENTS.md

## Contexto del Proyecto

Este repositorio contiene una aplicacion Electron para generar carruseles educativos de Academy by Total Therapy usando Nano Banana Pro / Gemini image generation.

El objetivo inmediato es evolucionar la app desde un compositor de imagen individual hacia un gestor completo de carruseles:

```text
CSV de ideas + lineamientos Academy embebidos -> cola de generacion -> carruseles PNG -> revision -> aprobacion -> exportacion
```

## Reglas de Trabajo

- Trabajar dentro de `/Users/paul/Diego/Proyectos/Image-gen`.
- No borrar ni reemplazar cambios existentes del usuario.
- Mantener `outputs/` como carpeta de salida por defecto.
- No commitear secretos, credenciales ni archivos generados.
- No guardar API keys en el repositorio.
- Preferir cambios pequenos y verificables por fase.
- Usar `rg` para buscar archivos o texto.
- Usar `apply_patch` para ediciones manuales.

## Stack Actual

- Electron.
- JavaScript CommonJS.
- Renderer HTML/CSS/JS sin framework.
- `src/main/main.js` para proceso principal e IPC.
- `src/main/preload.js` para API segura al renderer.
- `src/renderer/` para interfaz.
- `outputs/` para resultados.

## Credenciales y Google Cloud

El usuario indico:

- Google Cloud SDK instalado en `/Users/paul/google-cloud-sdk`.
- Credenciales ADC guardadas en `/Users/paul/.config/gcloud/application_default_credentials.json`.

La app debe soportar:

- API key.
- ADC con Google Cloud Project ID.

Nunca imprimir ni exponer secretos completos en logs, UI o metadata.

## Producto

La app debe permitir:

- Importar CSV de ideas.
- Usar lineamientos fijos del manual Academy integrados en el prompt. No debe existir opcion de importar manual.
- Configurar Nano Banana Pro.
- Seleccionar ideas individuales o por rango.
- Generar carruseles de 4 o 5 slides 1:1.
- Cancelar una generacion por lote en curso.
- Guardar todas las imagenes en `outputs/`.
- Usar assets reales de Academy para logo/isotipo cuando se mande referencia visual al modelo.
- Mostrar referencia de capitulo/pagina solo en el ultimo slide del carrusel.
- Revisar slides.
- Regenerar slide individual o carrusel completo.
- Aprobar carruseles.
- Eliminar carruseles generados moviendo su carpeta a la papelera.
- Exportar PNGs aprobados.
- Opcionalmente exportar PDF de revision.

## CSV Requerido

Columnas obligatorias:

```csv
id,titulo,concepto_clave,publico_objetivo,capitulo_referencia,pagina_referencia,sugerencia_visual,estado
```

Estados esperados:

- `pendiente`
- `generada`
- `en_revision`
- `aprobada`
- `error`

Si una fila no cumple las columnas, la app debe mostrar un error claro y no corromper el estado existente.

## Estructura de Salida

Usar esta estructura por defecto:

```text
outputs/
  ideas/
  carruseles/
    carrusel_001_slug/
      slide_01.png
      slide_02.png
      slide_03.png
      slide_04.png
      metadata.json
  exports/
  state/
```

Cada `metadata.json` debe incluir:

- idea original.
- prompts por slide.
- modelo.
- parametros de generacion.
- fecha.
- estado.
- rutas de imagenes.
- errores, si existieron.

## Direccion de Interfaz

Usar la skill `frontend-design` cuando se trabaje en UI.

Principios:

- La primera pantalla debe ser el dashboard operativo, no una landing page.
- La UI debe sentirse editorial, medica y profesional.
- Usar Poppins y colores Academy:
  - `#FF9900`
  - `#203078`
  - `#003399`
- Evitar estetica generica de IA.
- Usar controles funcionales y familiares:
  - tabs
  - filtros
  - checkboxes
  - icon buttons
  - progress bars
  - tablas/grids escaneables
  - visor de carrusel
- Mantener textos dentro de sus contenedores en mobile/desktop.
- No meter tarjetas dentro de tarjetas.

## Agentes / Roles Sugeridos

### Product Planner

Responsable de convertir requisitos en fases pequenas y criterios de aceptacion.

Entregables:

- actualizar `plan.md`.
- definir flujos.
- detectar decisiones pendientes.

### Electron Main Agent

Responsable del proceso principal.

Tareas:

- IPC.
- dialogos de archivo.
- persistencia.
- cola de generacion.
- cancelacion de lote en curso.
- llamadas a Gemini/Vertex.
- guardado de outputs.
- exportacion.

Archivos principales:

- `src/main/main.js`
- `src/main/preload.js`

### Data Agent

Responsable de carga, validacion y estado.

Tareas:

- parser CSV.
- modelo de datos.
- estados de ideas/carruseles.
- metadata.

### Prompt Agent

Responsable de prompts para Nano Banana Pro.

Tareas:

- plantilla base de carrusel.
- prompts por slide.
- reglas de marca y legibilidad.
- primera imagen llamativa, con muy poco texto y sin referencia visible.
- referencia de capitulo/pagina visible solo en el ultimo slide.
- envio de logo/isotipo real como referencia visual al modelo para evitar logos alucinados.
- prompts de regeneracion granular.
- conservar trazabilidad en metadata.

### Renderer/UI Agent

Responsable de la interfaz.

Tareas:

- dashboard.
- filtros y seleccion.
- cola de progreso.
- visor de carrusel.
- panel de settings.
- exportacion.

Debe seguir la direccion `frontend-design` y evitar UI decorativa sin funcion.

### QA Agent

Responsable de pruebas manuales y automatizadas.

Flujos a validar:

- abrir app.
- cargar CSV valido.
- rechazar CSV invalido.
- guardar settings.
- generar una idea.
- reanudar despues de error.
- regenerar slide.
- aprobar carrusel.
- eliminar carrusel generado.
- exportar lote aprobado.
- abrir carpeta output.

## Convenciones de Implementacion

- Mantener nombres de IPC con prefijo de dominio: `ideas:*`, `generation:*`, `carousel:*`, `export:*`.
- Sanitizar nombres de carpetas con slugs.
- No bloquear el renderer durante generaciones largas.
- Guardar progreso despues de cada slide.
- Usar errores descriptivos en espanol para la UI.
- Mantener metadata en JSON legible.
- Para MVP, JSON local es aceptable; SQLite se considera si el historial crece.

## Verificacion Antes de Finalizar Cambios

Minimo:

```bash
npm start
```

Cuando haya UI significativa:

- abrir la app.
- revisar que no haya desbordes de texto.
- verificar que los botones principales existan y funcionen.
- probar al menos un flujo feliz o simulado si la API no esta disponible.

Cuando haya generacion real:

- confirmar que `outputs/carruseles/...` contiene PNGs y `metadata.json`.
- confirmar que no se guardaron secretos en metadata.
