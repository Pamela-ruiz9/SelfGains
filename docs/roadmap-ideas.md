# Backlog de ideas — sin priorizar aún

Este documento junta ideas de negocio que salieron en brainstorming (2026-08-16) pero que **todavía no se van a implementar**. No es un spec — cuando se decida arrancar alguna, pasa por el proceso normal (brainstorming → spec → plan) y se borra de acá.

## Roles y permisos

- **Rol de entrenador**: un entrenador puede poner rutinas directamente en "mis rutinas" de un usuario que esté entrenando (no es lo mismo que activar una rutina predefinida — el entrenador la asigna desde afuera).
- Implica: relación entrenador↔alumno (quién entrena a quién), permisos distintos por rol, UI para que el entrenador gestione a sus alumnos y les asigne/edite rutinas.
- Relacionado: el entrenador probablemente necesita ver nivel/datos del alumno (ver "Perfil enriquecido" abajo) para asignar algo con sentido.

## Perfil enriquecido

- Sexo (femenino/masculino).
- Nivel de entrenamiento: principiante / básico / intermedio (¿avanzado?).
- Sin definir aún: si esto alimenta algo automático (ej. filtrar rutinas predefinidas por nivel) o es solo informativo para el entrenador.

## Compartir rutinas entre usuarios normales

- Marcado explícitamente como "plan a futuro" por el usuario, no roles de entrenador — cualquier usuario podría compartir una rutina que creó con otro usuario (sin relación entrenador↔alumno de por medio).
- Sin definir: mecanismo (link, código, buscar por nombre de usuario), si la rutina compartida es una copia o queda enlazada al original.

## Buscador de entrenadores cercanos (mapa + geolocalización)

- Sección de búsqueda con mapa mostrando entrenadores cercanos.
- Requiere: permiso de ubicación del usuario que busca, y que el entrenador opte explícitamente por ser visible/buscable (no automático).
- El subsistema más grande de todos — implica integrar un mapa, geolocalización, y probablemente enriquecer el perfil del entrenador (especialidad, tarifa, etc.) para que la búsqueda tenga sentido.
- Sin definir: proveedor de mapas, radio de búsqueda, qué datos del entrenador se muestran en el resultado.

## Contenido: rutinas genéricas para otras disciplinas

- Ya existe contenido de running/natación/combate (ver `docs/agents/multi-disciplina-status.md`), pero las rutinas predefinidas (`src/content/plans/`) hoy son solo de gym (Push/Pull/Legs, Full Body).
- Pedido: sumar rutinas predefinidas genéricas para running/natación/combate, mismo patrón que las de gym.
- Es trabajo de contenido, no de diseño de producto — no necesita spec, se puede hacer directo cuando se priorice.

---

**Prioridad actual de la sesión (2026-08-16):** ninguna de las de arriba. El foco pasó a mejoras técnicas — ver `docs/superpowers/specs/` para el spec de PWA/fluidez UX que se está armando en paralelo a este backlog.
