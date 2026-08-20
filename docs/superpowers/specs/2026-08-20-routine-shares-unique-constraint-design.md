# Constraint único en routine_shares — diseño

Ítem de deuda técnica de `docs/roadmap-ideas.md` (sección Conexiones, compilado desde `docs/agents/descubrimiento-conexiones-status.md`): `routine_shares` no tiene constraint único, se puede proponer la misma rutina dos veces a la misma persona (ej. doble click en "Compartir"). Elegido directamente por el usuario de la lista de deuda técnica, sin pregunta de producto abierta.

**Pedido:** evitar que se acumulen propuestas duplicadas de la misma rutina a la misma persona.

**Explícitamente fuera de esta ronda:**
- Bloquear re-proponer la misma rutina después de que la propuesta anterior se aceptó o rechazó — decidido explícitamente que NO, para no frustrar el caso legítimo de "la rechacé hace tiempo, ahora la quiero" o "la edité, la vuelvo a mandar".
- Cualquier cambio a `acceptRoutineShare`/`rejectRoutineShare` o a la condición de carrera documentada por separado en la misma lista de deuda técnica — es un ítem distinto, no se toca acá.
- Cualquier cambio de UI más allá del mensaje de error puntual — el flujo de "Compartir" (`ShareRoutinePicker` en `src/components/react/RoutineManager/RoutineList.tsx`) sigue igual.

## Enfoque técnico elegido

**Índice único parcial, no un constraint sobre toda la tabla.** Solo cuentan las filas `pending`:

```sql
create unique index routine_shares_no_duplicate_pending
  on routine_shares (routine_id, to_user_id)
  where status = 'pending';
```

No incluye `from_user_id` en la clave — la política de RLS de insert ya exige `routines.user_id = auth.uid()`, así que un `routine_id` dado tiene siempre un único `from_user_id` legítimo posible; agregarlo al índice no cambiaría qué se bloquea, solo lo haría más ancho sin necesidad.

**El insert que choca contra el índice se traduce a un mensaje claro, no se deja pasar el error crudo de Postgres.** `proposeRoutineShare()` en `src/lib/routineShares.ts` agrega un catch para el código `23505` (violación de constraint único), mismo patrón de distinguir "duplicado esperado" de "error real" que ya usa el resto del proyecto (ej. `createOrRegenerateInviteCode` en `src/lib/connections.ts`).

## Cambios

**`supabase/schema.sql`** (migración append-only, mismo patrón que el resto del archivo):

```sql

-- Constraint único en routine_shares
-- (docs/superpowers/specs/2026-08-20-routine-shares-unique-constraint-design.md).
-- Parcial (solo pending) para no bloquear re-proponer la misma rutina
-- después de que una propuesta anterior se aceptó o rechazó.
create unique index routine_shares_no_duplicate_pending
  on routine_shares (routine_id, to_user_id)
  where status = 'pending';
```

**`src/lib/routineShares.ts`**, función `proposeRoutineShare`:

```ts
export async function proposeRoutineShare(routineId: string, toUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('routine_shares')
    .insert({ routine_id: routineId, from_user_id: user.id, to_user_id: toUserId });
  if (error) {
    if (error.code === '23505') throw new Error('Ya le propusiste esta rutina y sigue pendiente.');
    throw error;
  }
}
```

Nada más cambia — `ShareRoutinePicker` (el componente que llama a esta función) ya maneja cualquier error lanzado mostrando `err.message`, así que el mensaje nuevo aparece automáticamente sin tocar la UI.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios.
- Migración aplicada contra el proyecto real (`supabase db query --linked --file ...`), verificada con una consulta a `pg_indexes`.
- Playwright contra dos cuentas de prueba conectadas: proponer la misma rutina dos veces seguidas al mismo destinatario mientras la primera sigue pendiente → la segunda debe fallar con el mensaje "Ya le propusiste esta rutina y sigue pendiente." (no un error crudo, no una fila duplicada). Aceptar o rechazar la propuesta y volver a proponer la misma rutina a la misma persona → debe funcionar sin error.
