# Backlog de ideas — sin priorizar aún

Este documento junta ideas de negocio que salieron en brainstorming (2026-08-16) pero que **todavía no se van a implementar**. No es un spec — cuando se decida arrancar alguna, pasa por el proceso normal (brainstorming → spec → plan) y se borra de acá.

**Actualizado 2026-08-19**: se resolvieron "Rol de entrenador" (`docs/agents/rol-entrenador-status.md`), "Compartir rutinas entre usuarios normales" y "Buscador de entrenadores cercanos" (ambas en `docs/agents/descubrimiento-conexiones-status.md`) — se sacaron de este backlog. Quedan dos ideas de producto abiertas, más una lista de deuda técnica compilada de los docs de cada feature (antes vivía dispersa en la sección "Lo que falta" de cada uno).

## Ideas de producto abiertas

### Perfil enriquecido

- Sexo (femenino/masculino).
- Nivel de entrenamiento: principiante / básico / intermedio (¿avanzado?).
- Sin definir aún: si esto alimenta algo automático (ej. filtrar rutinas predefinidas por nivel) o es solo informativo para el entrenador. Necesita un brainstorm corto antes de implementar.

### Rutinas predefinidas para otras disciplinas

- Ya existe contenido de running/natación/combate (ver `docs/agents/multi-disciplina-status.md`), pero las rutinas predefinidas (`src/content/plans/`) hoy son solo de gym (Push/Pull/Legs, Full Body).
- Pedido: sumar rutinas predefinidas genéricas para running/natación/combate, mismo patrón que las de gym.
- Es trabajo de contenido, no de diseño de producto — no necesita spec, se puede hacer directo cuando se priorice.

## Deuda técnica / mejoras pendientes (compilado 2026-08-19)

Ninguno de estos es un bug bloqueante — son limitaciones conocidas y aceptadas o funcionalidad que quedó afuera del alcance original de cada feature. Fuente: sección final de cada `docs/agents/*-status.md`.

- **Perfil** (`perfil-y-personalizacion-status.md`): no hay borrar cuenta desde la UI (solo cerrar sesión); no se puede recortar la foto al subirla; el historial de medidas no se puede editar/borrar fila por fila.
- **Explorador Muscular 3D** (`muscle-explorer-3d-status.md`): el checklist manual (Task 7) nunca se corrió con un humano en un navegador real — falta probar el tacto en mobile y el fallback sin WebGL; el bundle pesa ~1.03MB sin code-splitting.
- **Registrar / copiar entrenamiento** (`mobile-nav-y-registro-ux-status.md`): "copiar un entrenamiento anterior" es todo-o-nada, no se pueden elegir series/sesiones sueltas; los presets de duración/distancia de `SessionFields` están fijos, no varían por disciplina.
- **Progreso** (`progreso-graficas-prs-status.md`): no hay 1RM estimado; no hay gráfico de volumen total (solo peso máximo/ritmo por sesión); no se pueden comparar/superponer varios ejercicios a la vez; no hay filtro por rango de fechas; los umbrales de progresión/deload son constantes fijas, no configurables por el usuario.
- **Rol de entrenador** (`rol-entrenador-status.md`): reasignar una rutina ya recibida de otro entrenador pisa `assigned_by_name` en silencio, perdiendo de quién era originalmente — sin definir en el spec, no es exactamente un bug.
- **Conexiones** (`descubrimiento-conexiones-status.md`): `Connections.tsx` tiene ~650 líneas / seis secciones en un solo archivo — conviene dividirlo antes de sumarle una séptima; `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones simultáneas (borde muy angosto, sin corrupción de datos); `routine_shares` no tiene constraint único, se puede proponer la misma rutina dos veces.
