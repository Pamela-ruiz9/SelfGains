# Procedencia original de una rutina reasignada — diseño

Ítem de deuda técnica documentado en `docs/agents/rol-entrenador-status.md` ("Lo que falta"): "reasignar una rutina que ya se recibió de otro entrenador pisa `assigned_by_name` en silencio, descartando la cadena de procedencia original — consistente con 'copia, no referencia', pero no está explícitamente decidido en el spec". Esta ronda lo define y lo cierra.

**Escenario:** `assignRoutineToStudent` hace una copia de fila completa (no una referencia) al asignar una rutina a un alumno conectado — así fue diseñado a propósito (ver `docs/superpowers/specs/2026-08-18-rol-entrenador-design.md`). El selector de "asignar a un alumno" (`AssignRoutinePicker`, alimentado por `getMyRoutines()`) no distingue rutinas propias de recibidas: cualquier usuario que sea entrenador puede tomar una rutina que él mismo recibió de OTRO entrenador y reasignársela a su propio alumno. Hoy, esa nueva copia solo guarda `assigned_by_name` = el nombre del reasignador — quién originalmente creó la rutina se pierde.

## Decisión

Cuando una rutina pasa por más de un salto (Ana crea → se la pasa a Juan → Juan se la pasa a Pedro), la procedencia original se conserva **siempre como la raíz** (Ana), sin importar cuántos saltos intermedios hubo — no solo el eslabón inmediatamente anterior. El selector de asignación **no** se restringe: se sigue pudiendo reasignar una rutina recibida (comportamiento intencional, confirmado con el usuario), solo se hace visible de dónde vino.

## Alcance

- `supabase/schema.sql`: nueva columna `original_author_name` en `routines`, más backfill de las filas existentes.
- `src/types/db.ts`: el tipo `Routine` gana el campo nuevo.
- `src/lib/routines.ts`: `assignRoutineToStudent` calcula y guarda `original_author_name` en la copia nueva.
- `src/components/react/RoutineManager/RoutineManager.tsx` y `RoutineList.tsx`: el campo nuevo viaja hasta la UI y se muestra cuando corresponde.

Nada de esto toca el modelo de conexiones, invitaciones, ni la política de RLS de `routines` (sigue siendo "el dueño de la fila gestiona su propia fila", sin cambios de permisos).

## 1. Modelo de datos

```sql
alter table routines add column original_author_name text;

-- Backfill: para las rutinas ya compartidas antes de este cambio, el único
-- dato de procedencia que existe es assigned_by_name — se usa como mejor
-- aproximación disponible (no hay forma de reconstruir una cadena que no se
-- trackeaba antes de ahora).
update routines set original_author_name = assigned_by_name where assigned_by_name is not null;
```

`original_author_name` es `null` para cualquier rutina que el usuario creó él mismo y nunca compartió (mismo criterio que ya usa `assigned_by_name` hoy). No lleva política de RLS propia — es una columna más de una tabla que ya tiene su política a nivel de fila.

`src/types/db.ts` — `Routine` pasa de:

```ts
export interface Routine {
  id: string;
  user_id: string;
  name: string;
  days: RoutineDays;
  created_at: string;
  assigned_by_name: string | null;
}
```

a:

```ts
export interface Routine {
  id: string;
  user_id: string;
  name: string;
  days: RoutineDays;
  created_at: string;
  assigned_by_name: string | null;
  original_author_name: string | null;
}
```

## 2. Lógica de asignación (`src/lib/routines.ts`)

`assignRoutineToStudent(routineId, studentUserId)` ya lee la rutina origen (`source`) y el nombre del asignador actual (`myProfile?.display_name ?? 'tu entrenador'`) antes de insertar la copia. Se agrega el cálculo de `original_author_name` de la copia nueva:

- Si `source.assigned_by_name` es `null` (la rutina la creó el propio asignador, nunca fue compartida antes) → el asignador actual ES el original: `original_author_name = miNombre`.
- Si `source.assigned_by_name` no es `null` (la rutina que estás reasignando ya te la habían compartido a vos) → se propaga tal cual: `original_author_name = source.original_author_name ?? source.assigned_by_name` (el fallback a `assigned_by_name` cubre el caso de una fila vieja que todavía no pasó por el backfill de esta migración, aunque en la práctica el backfill de arriba ya deja `original_author_name` seteado para todas las filas existentes con `assigned_by_name`).

`assigned_by_name` de la copia nueva no cambia: sigue siendo siempre el nombre del asignador actual (quien ejecuta esta acción ahora), igual que hoy.

```ts
export async function assignRoutineToStudent(routineId: string, studentUserId: string): Promise<void> {
  const source = await getRoutineById(routineId);
  if (!source) throw new Error('No se encontró la rutina a asignar.');

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .maybeSingle();

  const myName = myProfile?.display_name ?? 'tu entrenador';
  const originalAuthorName = source.assigned_by_name
    ? (source.original_author_name ?? source.assigned_by_name)
    : myName;

  const { error } = await supabase.from('routines').insert({
    user_id: studentUserId,
    name: source.name,
    days: source.days,
    assigned_by_name: myName,
    original_author_name: originalAuthorName,
  });

  if (error) throw error;
}
```

(El comentario existente sobre por qué no se usa `.select()` en el `insert` no cambia — sigue aplicando igual.)

## 3. Visualización (`RoutineManager.tsx` + `RoutineList.tsx`)

`RoutineManager.tsx` ya arma `customOptions` a partir de `myRoutines` pasando `assignedByName: r.assigned_by_name`. Se agrega el campo espejo:

```ts
const customOptions: RoutineOption[] = myRoutines.map((r) => ({
  ref: r.id,
  name: r.name,
  days: r.days,
  assignedByName: r.assigned_by_name,
  originalAuthorName: r.original_author_name,
}));
```

`RoutineList.tsx` gana el campo en su interfaz de opción (junto a `assignedByName?: string | null`) y cambia la línea que hoy es:

```tsx
{routine.assignedByName && (
  <p className="font-mono text-xs text-paper-dim">Compartida por: {routine.assignedByName}</p>
)}
```

por:

```tsx
{routine.assignedByName && (
  <p className="font-mono text-xs text-paper-dim">
    Compartida por: {routine.assignedByName}
    {routine.originalAuthorName && routine.originalAuthorName !== routine.assignedByName
      ? ` (originalmente de ${routine.originalAuthorName})`
      : ''}
  </p>
)}
```

Si `originalAuthorName` es igual a `assignedByName` (el caso normal de un solo salto, la gran mayoría de los casos hoy) o es `null`, se ve exactamente igual que ahora — sin redundancia ni ruido visual para el caso común.

## Casos borde

- **Rutina creada por uno mismo, nunca compartida:** `assigned_by_name` y `original_author_name` quedan `null`, no se muestra ninguna leyenda — sin cambios respecto a hoy.
- **Un solo salto (el caso más común):** `assigned_by_name === original_author_name`, se muestra igual que hoy ("Compartida por: X"), sin el paréntesis.
- **Reasignada dos o más veces:** se muestra "Compartida por: [último asignador] (originalmente de [creador original])", sin importar cuántos saltos intermedios hubo — los nombres intermedios no se guardan ni se muestran, por decisión explícita (ver sección "Decisión" arriba).
- **El asignador no tiene `display_name`:** se usa el mismo fallback `'tu entrenador'` que ya existe hoy, tanto para `assigned_by_name` como, si corresponde, para `original_author_name`.
- **Filas existentes previas a esta migración:** quedan con `original_author_name = assigned_by_name` vía el backfill — se van a ver como "un solo salto" (sin paréntesis) aunque en la realidad pudieran haber tenido más saltos antes de esta feature; es una limitación aceptada, no hay forma de reconstruir un historial que no se trackeaba.

## Explícitamente fuera de esta ronda

- Bloquear o advertir al reasignar una rutina recibida — se sigue permitiendo sin restricción, por decisión explícita del usuario.
- Guardar la cadena completa de reasignaciones (todos los nombres intermedios) — se decidió explícitamente guardar solo la raíz, no un array de saltos.
- Sincronizar retroactivamente el nombre si alguien en la cadena cambia su `display_name` después — mismo criterio ya existente para `assigned_by_name` (es una foto congelada al momento de asignar, no una referencia viva).
- Cualquier cambio al modelo de conexiones, invitaciones, o políticas de RLS de `routines` — no aplica, esto es puramente agregar un campo informativo.

## Verificación

Igual que el resto del proyecto: sin suite automatizada. `npm run build` + `npx tsc --noEmit` limpios (ignorando el error preexistente ya documentado en `ProgressList.tsx`, no relacionado). Solo hay dos cuentas de prueba reutilizables conocidas (`crud-e2e-1786826288@gmail.com`, `rutinastest1786031687911@gmail.com`) — probar una cadena de 3 personas real requeriría una tercera cuenta nueva, con el riesgo de rate-limit de emails que ya documentó una sesión anterior. En su lugar, un **round-trip con las dos cuentas existentes prueba la misma lógica**: cuenta A crea una rutina y se la asigna a cuenta B (confirmar que B ve "Compartida por: A", sin paréntesis — un solo salto); cuenta B reasigna esa misma rutina recibida de vuelta a cuenta A (permitido, la conexión es simétrica) — confirmar que A ahora ve una copia nueva con "Compartida por: B (originalmente de A)", demostrando que el campo `original_author_name` viajó intacto en el segundo salto en vez de pisarse con el nombre de B. Limpiar las rutinas de prueba creadas al terminar (no hace falta desconectar las cuentas, ya estaban conectadas de sesiones anteriores).
