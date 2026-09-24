# Backlog de ideas — sin priorizar aún

Este documento junta ideas de negocio que salieron en brainstorming (2026-08-16) pero que **todavía no se van a implementar**. No es un spec — cuando se decida arrancar alguna, pasa por el proceso normal (brainstorming → spec → plan) y se borra de acá.

**Actualizado 2026-08-19**: se resolvieron "Rol de entrenador" (`docs/agents/rol-entrenador-status.md`), "Compartir rutinas entre usuarios normales" y "Buscador de entrenadores cercanos" (ambas en `docs/agents/descubrimiento-conexiones-status.md`) — se sacaron de este backlog. Más tarde ese mismo día se resolvió también "Rutinas predefinidas para otras disciplinas" (`docs/agents/rutinas-otras-disciplinas-status.md`) y, por último, "Perfil enriquecido" (`docs/agents/perfil-enriquecido-status.md`). No queda ninguna idea de producto abierta en este backlog — solo la lista de deuda técnica compilada de los docs de cada feature (antes vivía dispersa en la sección "Lo que falta" de cada uno).

**Actualizado 2026-09-24**: se resolvió "App bilingüe ES/EN — infraestructura + interfaz" (`docs/agents/bilingue-es-en-status.md`) — mergeado a `main`. Esto abre un ítem de producto nuevo, explícitamente diferido desde esa misma ronda:

## Próximo ítem sugerido: Ronda 2 — traducción de contenido (ejercicios/rutinas)

Con la infraestructura bilingüe ya en `main`, la interfaz completa responde en inglés pero los ~86 archivos de contenido (`src/content/activities/*.md`, `src/content/plans/*.md` — nombres e instrucciones de ejercicios y rutinas) siguen solo en español en ambos idiomas. Es el próximo paso natural para que la app sea realmente bilingüe de punta a punta. **Necesita su propio brainstorming antes de spec/plan** (no depende de nada técnico pendiente — la infraestructura no necesita cambios). Preguntas abiertas y contexto completo en la sección final de `docs/agents/bilingue-es-en-status.md` (esquema de datos para el contenido en inglés, si reusar o re-curar las imágenes ya existentes, quién traduce, tono de vocabulario de gimnasio en inglés).

## Deuda técnica / mejoras pendientes (compilado 2026-08-19)

Ninguno de estos es un bug bloqueante — son limitaciones conocidas y aceptadas o funcionalidad que quedó afuera del alcance original de cada feature. Fuente: sección final de cada `docs/agents/*-status.md`.

- **Perfil** (`perfil-y-personalizacion-status.md`; borrar cuenta resuelto en `borrar-cuenta-status.md`): no se puede recortar la foto al subirla; el historial de medidas no se puede editar/borrar fila por fila.
- **Explorador Muscular 3D** (`muscle-explorer-3d-status.md`): el checklist manual (Task 7) nunca se corrió con un humano en un navegador real — falta probar el tacto en mobile y el fallback sin WebGL; el bundle pesa ~1.03MB sin code-splitting.
- **Registrar / copiar entrenamiento** (`mobile-nav-y-registro-ux-status.md`, `copiar-entrenamiento-parcial-status.md`): los presets de duración/distancia de `SessionFields` están fijos, no varían por disciplina. (La selección parcial al copiar un día anterior ya se resolvió — ver el segundo status doc.)
- **Progreso** (`progreso-graficas-prs-status.md`; 1RM/volumen resuelto en `1rm-y-volumen-total-status.md`): no se pueden comparar/superponer varios ejercicios a la vez; no hay filtro por rango de fechas; los umbrales de progresión/deload son constantes fijas, no configurables por el usuario.
- **Rol de entrenador** (`rol-entrenador-status.md`): resuelto — ver `procedencia-original-rutina-compartida-status.md`. No queda deuda técnica pendiente de Rol de entrenador.
- **Conexiones** (`descubrimiento-conexiones-status.md`, `dividir-connections-status.md`, `routine-shares-unique-constraint-status.md`, `accept-routine-share-atomic-status.md`): resuelto — ver el último status doc. No queda deuda técnica pendiente de Conexiones.
- **App bilingüe ES/EN** (`bilingue-es-en-status.md`): el diccionario de traducciones tiene texto duplicado entre pantallas ("Cargando...", "Guardando...", el patrón de 3 claves `notLoggedIn`) — candidato a un namespace `common` compartido, sin apuro; `CreateRoutineForm.tsx` no le pasa traducciones a `ActivityPicker` (cae al español ahí); manifest de la PWA y service worker no traducidos/precacheados para `/en/`, quedó fuera de alcance a propósito; templates de email de Supabase siguen en español (se configuran desde el dashboard, no desde este repo).
