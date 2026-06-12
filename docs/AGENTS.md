# AGENTS.md — Academy Carousel Generator

> Documento SDD · Borrador inicial. Instrucciones permanentes para agentes de IA que trabajen en este repositorio.
> Coherente con [PLAN.md](PLAN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SPEC.md](SPEC.md) y [TASK.md](TASK.md).
> Complementa el `AGENTS.md` de la raíz del repositorio; en lo referente al ciclo SDD, este documento es la guía operativa.

## 1. Idioma de trabajo

Responder, documentar y escribir mensajes de UI/errores en **español**.

## 2. Rol esperado del agente

Ejecutor controlado por especificación: **implementa el contrato ya definido**, no decide el producto. No agrega funcionalidades ni cambia arquitectura por iniciativa propia.

## 3. Documentos que debe leer antes de implementar

Antes de cualquier cambio, leer:

1. [SPEC.md](SPEC.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [TASK.md](TASK.md)
4. [PLAN.md](PLAN.md)
5. [TESTING.md](TESTING.md)

## 4. Prioridad entre documentos si hay conflicto

`SPEC.md` → `ARCHITECTURE.md` → `TASK.md` → `PLAN.md` → `AGENTS.md`. **El SPEC manda sobre el comportamiento.**

## 5. Stack obligatorio

Electron 31, JavaScript **CommonJS**, renderer HTML/CSS/JS **sin framework**, `fetch` nativo de Node para Gemini API / Vertex AI. No introducir TypeScript, frameworks UI ni SDKs sin aprobación.

## 6. Gestor de paquetes obligatorio

**npm**. No usar pnpm/yarn. No agregar dependencias salvo justificación explícita y aprobación.

## 7. Comandos principales del proyecto

- Instalar: `npm install`
- Ejecutar la app: `npm start`
- Chequeo de sintaxis: `node --check <archivo.js>`
- Verificación real de imagen (ADC): `node scripts/verify-vertex-image.js`

> No existen `typecheck`, `lint`, `test` ni `build`. No inventarlos ni asumir que existen.

## 8. Arquitectura que debe respetar

Separación **main / preload / renderer** con `contextIsolation: true` y `nodeIntegration: false`. Toda operación de filesystem/red vive en main y se expone por IPC con prefijos de dominio (`ideas:*`, `settings:*`, `generation:*`, `carousel:*`, `export:*`, `shell:*`). Ver [ARCHITECTURE.md](ARCHITECTURE.md).

## 9. Reglas de separación de capas

- El **renderer** nunca usa Node ni llama a la API; solo `window.academyAPI`.
- El **preload** solo declara el contrato IPC; sin lógica de negocio.
- El **main** concentra reglas de negocio, persistencia y llamadas externas.
- No duplicar lógica entre capas.

## 10. Restricciones de seguridad

- Nunca exponer/registrar secretos en UI, logs o `metadata.json`.
- API key siempre enmascarada al salir de main.
- Eliminar solo a la papelera (`shell.trashItem`).
- ADC solo desde `~/.config/gcloud/application_default_credentials.json` (`type: authorized_user`).
- No commitear `outputs/` generados, credenciales ni `.env`.

## 11. Acciones prohibidas sin confirmación

- Borrados permanentes, `rm -rf`, limpiar/forzar Git, resetear commits.
- Cambios de arquitectura o de contratos IPC.
- Alta de dependencias.
- Generación **real** que consuma créditos (preferir modo simulado salvo que se pida real).
- Modificar `metadata.json`/estado de forma masiva.

## 12. Reglas para instalar dependencias

Por defecto **no instalar**. Si una tarea lo exige: justificar la necesidad, proponer la dependencia, esperar aprobación y registrar la decisión en [ARCHITECTURE.md](ARCHITECTURE.md) §16.

## 13. Reglas para modificar documentación

Actualizar la documentación SDD **solo** si el cambio altera una decisión, un contrato o el comportamiento. Mantener coherencia entre los seis documentos. No tocar `docs/plan-legacy.md` (planificación histórica, superada por `docs/PLAN.md`) salvo que se pida.

## 14. Flujo de trabajo por tarea

1. Leer la tarea en [TASK.md](TASK.md).
2. Explicar el plan en 2–3 líneas.
3. Implementar **solo** esa tarea (o bloque aprobado de hasta 3 tareas de bajo riesgo).
4. Ejecutar las validaciones disponibles.
5. Reportar archivos modificados y resultado.
6. Indicar la siguiente tarea recomendada.

## 15. Formato de entrega al finalizar una tarea

Reportar:

1. Archivos creados o modificados.
2. Resumen técnico breve.
3. Comandos ejecutados.
4. Resultado de la validación.
5. Qué debe revisar el humano.
6. Siguiente tarea recomendada.

## 16. Criterio de terminado

Una tarea está terminada solo si: cumple su criterio del SPEC, pasa su validación, respeta la arquitectura, no agrega alcance no pedido, no filtra secretos y, si corresponde, deja la documentación coherente.

## 17. Convenciones de commits

Prefijos: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Mensajes en español, breves y descriptivos. **No** commitear automáticamente sin que se pida.

## 18. Convenciones de ramas

> El repo no tiene Git inicializado aún. Si se versiona, una rama por fase: `feat/<fase>` y `chore/hardening` (ver [TASK.md](TASK.md) §11). No trabajar tareas de alto riesgo en la rama principal.

## 19. Qué hacer si encuentra ambigüedad

Detenerse y preguntar antes de implementar. No improvisar producto ni arquitectura. Proponer la interpretación más conservadora y dentro del MVP, y pedir confirmación.

## 20. Qué hacer si una validación falla

Detener el avance, reportar el error con su salida, no continuar a la siguiente tarea, y proponer la corrección mínima necesaria. No ocultar fallos ni declarar terminado algo que no pasó su validación.
