# Copiar entrenamiento parcial — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — "copiar un entrenamiento anterior" en Registrar era todo-o-nada, no se podían elegir series/sesiones sueltas. Elegido directamente por el usuario, acotado explícitamente a solo esta parte del bullet (el otro ítem, presets de duración/distancia por disciplina, queda pendiente). Proceso: brainstorming (una pregunta: estado inicial de los checkboxes) → spec (`docs/superpowers/specs/2026-08-20-copiar-entrenamiento-parcial-design.md`) → plan (`docs/superpowers/plans/2026-08-20-copiar-entrenamiento-parcial.md`) → implementación con subagent-driven-development.

## Qué se hizo

En `WorkoutLogger.tsx`, la sección "Copiar un entrenamiento anterior" ahora muestra, después de elegir un día, una lista con una fila por serie de gym y por sesión de otra disciplina de ese día — mismo formato de texto que ya usa `WorkoutHistory.tsx` para mostrar series/sesiones pasadas (verificado carácter por carácter en la revisión de calidad, incluidos los casos de RPE/distancia nulos), con conversión de unidad de peso vía `kgToDisplay`. Cada fila tiene un checkbox, todas tildadas por defecto al elegir el día (decisión explícita: minimiza fricción para el caso común de copiar todo). El botón pasó de "Copiar a este día" a "Copiar seleccionados (N)", deshabilitado si N=0. Cambiar de día en el selector re-tilda todo para el día nuevo, sin arrastrar la selección anterior.

`copyWorkout` ahora recibe los dos `Set<string>` de ids seleccionados (usando el `id` real de `WorkoutSet`/`WorkoutSession`, ya existente en la base) y filtra antes de armar los `LoggedSet`/`LoggedSession` — el resto de su lógica (numeración de series por ejercicio, resolución de nombre) no cambió; la numeración de series sigue quedando consecutiva aunque se destilde una serie del medio.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (único error preexistente esperado en `ProgressList.tsx`).
- Playwright contra la cuenta de prueba real: se registró un día de origen con 2 ejercicios de gym distintos + 1 sesión de running para tener datos mixtos que probar. Confirmado end-to-end:
  - Al elegir el día aparecen las 3 filas, todas tildadas, botón "Copiar seleccionados (3)".
  - Destildar una serie cambia el botón a "(2)"; copiar deja solo esas 2 filas en el borrador de hoy (confirmado que la serie destildada no aparece).
  - Cambiar a otro día re-tilda completo para el día nuevo (no arrastra la selección parcial anterior); volver al día original también re-tilda completo (no recuerda el destilde previo).
  - Copiar sin destildar nada sigue copiando el día completo — mismo resultado que el botón viejo.
- Entrenamiento de prueba creado para esta verificación borrado de la cuenta reutilizable al terminar.

## Lo que falta / no cubierto en esta ronda

- Los presets de duración/distancia de `SessionFields` siguen fijos, no varían por disciplina — otro ítem separado del mismo bullet de deuda técnica original, no se tocó acá.
- Revisión de calidad sugirió (no bloqueante, no implementado): un mensaje de confirmación tipo "se copiaron N elementos" tras copiar, y separar el conteo del botón en "series"/"sesiones" en vez de un solo número combinado cuando hay de los dos tipos — quedan como posibles mejoras futuras, no se consideraron necesarias para cerrar este ítem.
