# Backlog de ideas — sin priorizar aún

Este documento junta ideas de negocio que salieron en brainstorming (2026-08-16) pero que **todavía no se van a implementar**. No es un spec — cuando se decida arrancar alguna, pasa por el proceso normal (brainstorming → spec → plan) y se borra de acá.

**Actualizado 2026-08-19**: se resolvieron "Rol de entrenador" (`docs/agents/rol-entrenador-status.md`), "Compartir rutinas entre usuarios normales" y "Buscador de entrenadores cercanos" (ambas en `docs/agents/descubrimiento-conexiones-status.md`) — se sacaron de este backlog. Más tarde ese mismo día se resolvió también "Rutinas predefinidas para otras disciplinas" (`docs/agents/rutinas-otras-disciplinas-status.md`) y, por último, "Perfil enriquecido" (`docs/agents/perfil-enriquecido-status.md`). No queda ninguna idea de producto abierta en este backlog — solo la lista de deuda técnica compilada de los docs de cada feature (antes vivía dispersa en la sección "Lo que falta" de cada uno).

**Actualizado 2026-09-24**: se resolvió "App bilingüe ES/EN — infraestructura + interfaz" (`docs/agents/bilingue-es-en-status.md`) — mergeado a `main`. También se resolvió la Ronda 2 (traducción del contenido de ejercicios y rutinas, `docs/agents/bilingue-es-en-status.md`). Otra vez no queda ninguna idea de producto abierta en este backlog. También se hizo el lote de cierre (manifest en inglés, service worker, `npm test` en CI y errata), mergeado a `main` — ver `docs/agents/bilingue-es-en-status.md`.

## Deuda técnica / mejoras pendientes (compilado 2026-08-19)

Ninguno de estos es un bug bloqueante — son limitaciones conocidas y aceptadas o funcionalidad que quedó afuera del alcance original de cada feature. Fuente: sección final de cada `docs/agents/*-status.md`.

- **Perfil** (`perfil-y-personalizacion-status.md`; borrar cuenta resuelto en `borrar-cuenta-status.md`): no se puede recortar la foto al subirla; el historial de medidas no se puede editar/borrar fila por fila.
- **Explorador Muscular 3D** (`muscle-explorer-3d-status.md`): el checklist manual (Task 7) nunca se corrió con un humano en un navegador real — falta probar el tacto en mobile y el fallback sin WebGL; el bundle pesa ~1.03MB sin code-splitting.
- **Registrar / copiar entrenamiento** (`mobile-nav-y-registro-ux-status.md`, `copiar-entrenamiento-parcial-status.md`): los presets de duración/distancia de `SessionFields` están fijos, no varían por disciplina. (La selección parcial al copiar un día anterior ya se resolvió — ver el segundo status doc.)
- **Progreso** (`progreso-graficas-prs-status.md`; 1RM/volumen resuelto en `1rm-y-volumen-total-status.md`): no se pueden comparar/superponer varios ejercicios a la vez; no hay filtro por rango de fechas; los umbrales de progresión/deload son constantes fijas, no configurables por el usuario.
- **Rol de entrenador** (`rol-entrenador-status.md`): resuelto — ver `procedencia-original-rutina-compartida-status.md`. No queda deuda técnica pendiente de Rol de entrenador.
- **Conexiones** (`descubrimiento-conexiones-status.md`, `dividir-connections-status.md`, `routine-shares-unique-constraint-status.md`, `accept-routine-share-atomic-status.md`): resuelto — ver el último status doc. No queda deuda técnica pendiente de Conexiones.
- **App bilingüe ES/EN** (`bilingue-es-en-status.md`; Rondas 1 y 2 completas, solo queda esto):
  - Diccionario (`src/i18n/`): texto duplicado entre pantallas ("Cargando...", "Guardando...", el patrón `notLoggedIn`), candidato a un namespace `common`.
  - Templates de email de Supabase en español (se configuran desde el dashboard).
  - `GROUP_LABELS` (`src/lib/activities.ts`) y `MUSCLES[].label` (`src/lib/muscles.ts`) duplican `es.groups`/`es.muscles`: armarlos desde el diccionario.
  - `public/sw.js` cachea respuestas sin chequear `response.ok` (un 404 de `/_astro/` se serviría cache-first hasta el próximo bump de versión; un HTML 404/5xx podría pisar una página buena): guardar con `if (response.ok)`.
  - Comentario de una línea sobre `VERSION` en `public/sw.js`: subirla cada vez que cambie `SHELL`.
  - Pulido de `tests/pwa.test.mjs`: generalizar el mapeo URL → fuente de `SHELL` (`rel.endsWith('/') ? src/pages/${rel}index.astro : public/${rel}`), tolerar comillas dobles al parsear `SHELL`, `.trim()` en los `run` del workflow.
  - Exports sin uso `Locale`, `LocalizedActivity`, `LocalizedPlan` en `src/lib/content-i18n.ts`.
  - Helper compartido para cargar y localizar actividades (bloque repetido en 6 páginas ×2 de `src/pages/`).
  - `progreso` usa `a.muscles?.[0] ?? ''`: debería caer en `UNKNOWN_MUSCLE` ('Otros', `src/lib/prs.ts`).
  - Pulido de `tests/content-coverage.test.mjs` (`fileURLToPath` en vez de `new URL(...).pathname`, que rompe con espacios en la ruta; juntar todas las fallas, allow-list que falle si deja de ser idéntica) y `.trim()` en los `*_en` de `src/content.config.ts`.
  - Comentario sobre `levelLabel` en `PredefinedRoutine` (`RoutineManager`).
  - Contenido en español sin cambiar: `remo-al-menton` dice "Barra o mancuernas" pero describe solo barra; `natacion-dorso-patada` se llama "Patada (tabla)" sin mencionar tabla.
  - Gustos de inglés a decidir: `Others` vs `Other`, `Cable` vs `Cable machine`, "glove work" en la clase de boxeo.
