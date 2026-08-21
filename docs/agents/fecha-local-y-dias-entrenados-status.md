# Fecha local (CDMX) y días entrenados — status

**Fecha:** 2026-08-21
**Pedido:** dos bugs reportados en vivo por el usuario: (1) la app mostraba la fecha adelantada un día por la noche en CDMX; (2) el conteo de "días cumplidos" en Rutinas no incluía entrenamientos de días no programados por la rutina activa (p. ej. fin de semana). Investigados con `systematic-debugging` antes de proponer cualquier fix. Proceso: root cause → spec (`docs/superpowers/specs/2026-08-20-fecha-local-y-dias-entrenados-design.md`) → plan (`docs/superpowers/plans/2026-08-20-fecha-local-y-dias-entrenados.md`) → implementación con subagent-driven-development.

## Qué se hizo

**Bug 1 (root cause):** tres lugares calculaban "hoy" con `new Date().toISOString().slice(0, 10)`, que convierte a UTC antes de cortar la fecha — a partir de ~18:00 hora CDMX (UTC-6) el reloj UTC ya cruzó la medianoche y muestra el día siguiente. Afectaba el campo Fecha de Registrar (un entrenamiento de noche podía guardarse bajo la fecha equivocada), el título "Hoy toca"/"Ese día toca", y `started_at` al activar una rutina. Se agregó `localDateStr()` en `src/lib/weekdays.ts` (fecha local correcta, sin pasar por UTC) y se reemplazaron los tres usos, más la copia privada equivalente que ya existía en `src/lib/adherence.ts`.

**Bug 2 (decisión de producto, no bug de lógica):** `weekAdherence()` solo contaba un día si la rutina activa tenía algo programado ese día — todas las rutinas actuales marcan sábado/domingo como descanso, así que un entrenamiento real de fin de semana nunca sumaba al conteo, aunque se guardara bien en la base. Confirmado con el usuario que el número debía pasar a contar cualquier día entrenado esta semana, sin filtrar por lo que programaba la rutina. `weekAdherence` dejó de recibir `routineDays`; los campos se renombraron (`scheduledDays`→`daysElapsed`, `completedDays`→`daysTrained`) porque el nombre viejo ya no describía lo que miden.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada task (único error preexistente esperado en `ProgressList.tsx`).
- Búsqueda exhaustiva confirmando que no queda ningún otro `toISOString().slice`/`getUTC*` para fechas de calendario en `src/`.
- Playwright contra la cuenta de prueba real (`crud-e2e-1786826288@gmail.com`): la verificación en vivo se hizo el 2026-08-21, que cayó viernes — la rutina custom activa de la cuenta marca viernes como día de descanso (`viernes: []`), igual que sábado/domingo, así que sirvió como caso equivalente al del plan sin esperar al fin de semana. Antes de loguear: "Esta semana: 1 de 5 días cumplidos". Se confirmó además que el campo Fecha de Registrar mostraba `2026-08-21` (fecha local correcta, no adelantada por UTC). Se logueó una serie de gym en ese día de descanso; después: "Esta semana: 2 de 5 días cumplidos" — el entrenamiento en un día no programado por la rutina ahora cuenta. Entrenamiento de prueba borrado al terminar; se confirmó que el conteo volvió a "1 de 5 días cumplidos".

## Lo que falta / no cubierto en esta ronda

- Nada — ambos bugs reportados quedaron resueltos.
