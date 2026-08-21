# Fecha local (CDMX) y "días entrenados" sin filtro de rutina — diseño

Dos bugs reportados por el usuario en vivo:

1. **La app muestra la fecha adelantada un día** — a las ~20:21 hora de Ciudad de México (CST, UTC-6) la app ya mostraba 21 en vez de 20.
2. **En Rutinas, "días cumplidos" no cuenta los entrenamientos de fin de semana** — aunque el usuario entrenó un sábado/domingo, no aparece reflejado en esa cifra.

## Root cause (investigación completa antes de proponer el fix)

**Bug 1**: tres lugares calculan "hoy" con `new Date().toISOString().slice(0, 10)`. `toISOString()` convierte a UTC **antes** de generar el string — como CDMX es UTC-6, a partir de ~18:00 hora local el reloj UTC ya cruzó la medianoche y muestra el día siguiente.
- `src/components/react/WorkoutLogger/WorkoutLogger.tsx:459` — el campo "Fecha" de Registrar arranca con la fecha de mañana después de las 18:00 CDMX. Esto no es solo cosmético: un entrenamiento registrado de noche queda guardado en la base bajo la fecha equivocada.
- `src/components/react/WorkoutLogger/WorkoutLogger.tsx:775` — la comparación que decide si el título dice "Hoy toca" o "Ese día toca" usa el mismo cálculo (consistente con el bug de arriba, pero igual de incorrecto).
- `src/lib/routines.ts:61` — activar una rutina de noche le pone `started_at` de mañana, corriendo un día el conteo de "Semana X — día Y" del programa activo.

`src/lib/adherence.ts` ya tenía la forma correcta (`localDateStr`, función privada, con un comentario explícito advirtiendo sobre este mismo problema) — nunca se compartió con el resto del código.

**Bug 2**: no es un bug de lógica — es intencional pero no es lo que el usuario quiere. `weekAdherence()` en `adherence.ts` solo cuenta un día si la rutina activa tiene algo programado ese día (`routineDays[weekday].length > 0`); todas las rutinas predefinidas actuales (y las nuevas por sexo) marcan sábado y domingo como descanso. Un entrenamiento real registrado en fin de semana se guarda bien en la base, pero el `continue` de esa función lo descarta antes de siquiera chequear si hay un entrenamiento logueado ese día — nunca puede sumar al conteo. Confirmado con el usuario: quiere que el número mida "días que entrené esta semana" en general, no "cuánto cumplí lo que mi rutina programó".

## Enfoque técnico elegido

**Un helper de fecha local compartido, exportado desde `src/lib/weekdays.ts`** (ya importado por los tres archivos con el bug) — reemplaza los tres usos de `toISOString().slice(0, 10)` y la copia privada que ya existía en `adherence.ts`.

**`weekAdherence()` deja de recibir `routineDays`.** Pasa de "¿cuánto cumplí lo que mi rutina programó esta semana?" a "¿cuántos días entrené esta semana, de los que ya pasaron?" — cuenta cualquier día con un entrenamiento logueado entre el lunes y hoy, sin mirar qué (si algo) tenía programado la rutina ese día. Los campos del resultado se renombran (`scheduledDays`→`daysElapsed`, `completedDays`→`daysTrained`) porque "scheduled" ya no describe lo que miden — dejar el nombre viejo sería documentación incorrecta en el código.

**`RoutineManager.tsx`** ya no necesita calcular `activeRoutineDays` (solo existía para pasárselo a `weekAdherence`) — la cifra sigue mostrándose únicamente cuando hay una rutina activa (es parte de esa tarjeta), pero ahora el gate es directamente `activeRoutine`, no los días de la rutina.

## Cambios

**`src/lib/weekdays.ts`** — nuevo export, colocado junto a `getTodayWeekday` (mismo tipo de helper: fecha/hora local, no UTC):

```ts
// Local calendar date as "YYYY-MM-DD" — deliberately not toISOString(),
// which converts to UTC first and can show tomorrow's date once local time
// crosses into the evening (e.g. from ~18:00 onward in a UTC-6 timezone
// like Mexico City).
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

**`src/lib/adherence.ts`**:
- Se saca la función privada `localDateStr` — se importa la de `./weekdays`.
- Se sacan los imports de `getTodayWeekday` y `RoutineDays` (ya no se usan).
- `WeekAdherence` pasa a `{ daysElapsed: number; daysTrained: number }`.
- `weekAdherence(workoutDates: Set<string>): WeekAdherence` — sin el parámetro `routineDays`; el loop deja de chequear `routineDays[weekday].length === 0`, cuenta cualquier día Lunes..hoy y si tiene un entrenamiento logueado.

**`src/components/react/WorkoutLogger/WorkoutLogger.tsx`**: las dos apariciones de `new Date().toISOString().slice(0, 10)` pasan a `localDateStr()` (importado de `../../../lib/weekdays`, donde ya se importan otras cosas de ese módulo).

**`src/lib/routines.ts`**: `started_at: new Date().toISOString().slice(0, 10)` pasa a `started_at: localDateStr()` (nuevo import de `./weekdays`).

**`src/components/react/RoutineManager/RoutineManager.tsx`**:
- Se saca la variable `activeRoutineDays`.
- `const adherence = activeRoutine ? weekAdherence(workoutDates) : null;`
- El JSX que muestra "Esta semana: X de Y días cumplidos" pasa a leer `adherence.daysTrained`/`adherence.daysElapsed` en vez de `completedDays`/`scheduledDays`.

## Explícitamente fuera de esta ronda

- Cualquier otro lugar de la app que muestre fecha/hora — la búsqueda fue exhaustiva sobre patrones `toISOString().slice`/`getUTC*` en todo `src/`, no se encontró ningún otro caso.
- Cambiar cómo se calculan `weeksElapsed`/`daysElapsed` (el contador de "Semana X de Y — día Z de W") — esos ya usan una resta de timestamps sin conversión a UTC de por medio, no tienen el bug; solo se benefician indirectamente de que `started_at` ahora se guarde con la fecha local correcta.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios.
- No es posible reproducir el bug de fecha en vivo cambiando la hora del sistema de forma confiable en este entorno — la verificación es por inspección directa: confirmar que ningún archivo en `src/` sigue usando `toISOString().slice` ni `getUTC*` para fechas de calendario, y ejercitar con Playwright el flujo de Registrar con la fecha ya corregida (comportamiento idéntico al de antes durante el día, que es cuando sí se puede probar).
- Playwright contra la cuenta de prueba real: registrar un entrenamiento un sábado o domingo (cambiando el campo Fecha manualmente a una fecha de fin de semana) con una rutina activa que no programa nada esos días — confirmar que "Esta semana: X de Y días cumplidos" ahora refleja ese entrenamiento en el conteo.
