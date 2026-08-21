# acceptRoutineShare atómico contra carrera concurrente — diseño

Último ítem de deuda técnica de Conexiones en `docs/roadmap-ideas.md`: `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones/pestañas simultáneas aceptando la misma propuesta — puede insertar dos copias de la rutina antes de que el UPDATE condicional detecte el conflicto. Elegido directamente por el usuario de la lista de deuda técnica, sin pregunta de producto abierta.

**Pedido:** que aceptar una propuesta de rutina compartida sea seguro contra dos llamadas concurrentes (doble click, dos pestañas del mismo usuario), sin crear copias duplicadas de la rutina.

**Estado actual del bug** (`src/lib/routineShares.ts`, `acceptRoutineShare`): el orden hoy es `SELECT` (leer `routine_id`, scoped a `to_user_id`/`status='pending'`) → `INSERT` (copiar la rutina a `routines`) → `UPDATE` condicional (`status='pending'` → `'accepted'`, solo afecta una fila). Si dos llamadas concurrentes pasan el `SELECT` mientras la propuesta sigue `pending`, **ambas** llegan al `INSERT` antes de que cualquiera intente el `UPDATE` — se crean dos copias de la rutina en `routines`. El `UPDATE` sigue funcionando bien para el *estado de la propuesta* (solo una de las dos llamadas logra marcarla `accepted`, la otra tira "Esta propuesta ya se resolvió en otro lado."), pero para entonces el daño (la copia duplicada) ya está hecho. No hay corrupción de `routine_shares`, solo de `routines` (una fila de más).

**Explícitamente fuera de esta ronda:**
- Cualquier función RPC de Postgres / transacción real en la base — decidido explícitamente mantener la convención del proyecto de "sin RPC, todo vía `supabase.from(...)`".
- Cualquier cambio a `rejectRoutineShare`, `getPendingRoutineShares`, `getSharedRoutinePreview`, `proposeRoutineShare` — no tienen el mismo problema (no hacen un insert dependiente de un estado que puede cambiar bajo los pies).
- Cualquier cambio de UI — `RoutineList.tsx`/`Connections.tsx` ya manejan cualquier error que lance esta función mostrando `err.message`.

## Enfoque técnico elegido

**Reordenar: reclamar la propuesta atómicamente antes de copiar la rutina, con reversión si la copia falla.**

El `UPDATE` condicional (`status='pending'` → `'accepted'`, con `.eq('to_user_id', auth.uid())` y `.eq('status', 'pending')`) pasa a ser el **primer** paso, no el último, y reemplaza también al `SELECT` inicial — el mismo `UPDATE` devuelve `routine_id` vía `.select('routine_id').single()`. Postgres solo permite que una transacción concurrente gane esa actualización condicional (row-level locking estándar); la llamada perdedora ve 0 filas afectadas (`.single()` sobre 0 filas es un error de PostgREST) y aborta ahí mismo — **nunca llega al `INSERT`**, así que la copia duplicada deja de ser posible por construcción, no por detección tardía.

El costo de mover el `UPDATE` primero es que, si el `INSERT` de la copia falla después (error de red, error de validación, lo que sea), la propuesta ya quedó marcada `accepted` sin que la rutina se haya copiado de verdad — un estado peor que el actual (hoy, si el insert falla, el `UPDATE` ni se intenta, así que la propuesta sigue `pending` y es reintentable). Para no introducir esa regresión, si el `INSERT` falla se revierte el reclamo (`UPDATE routine_shares SET status='pending' WHERE id=shareId`) antes de relanzar el error original — dejando la propuesta exactamente como estaba, reintentable.

## Cambios

**`src/lib/routineShares.ts`**, función `acceptRoutineShare` completa:

```ts
export async function acceptRoutineShare(shareId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  // Reclama la propuesta atómicamente antes de copiar nada: el UPDATE
  // condicional (.eq('status', 'pending')) solo puede afectar la fila una
  // vez, así que si dos llamadas concurrentes (doble click, dos pestañas)
  // llegan acá al mismo tiempo, como mucho una gana y sigue — la otra ve 0
  // filas afectadas y aborta antes de insertar ninguna copia de la rutina.
  // Reemplaza al SELECT que existía antes: el mismo UPDATE ya devuelve
  // routine_id, scoped a to_user_id = auth.uid().
  const { data: claimed, error: claimError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId)
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .select('routine_id')
    .single();
  if (claimError) throw new Error('Esta propuesta ya se resolvió en otro lado.');

  const source = await getSharedRoutinePreview(claimed.routine_id);
  if (!source) {
    // Revertir el reclamo: sin esto, la propuesta quedaría "accepted" para
    // siempre sin que el usuario tenga la rutina copiada, sin forma de
    // reintentar.
    await supabase.from('routine_shares').update({ status: 'pending' }).eq('id', shareId);
    throw new Error('No se encontró la rutina compartida.');
  }

  // Sin .select() después del insert, mismo motivo que assignRoutineToStudent
  // en src/lib/routines.ts: nada del lado del cliente necesita la fila de
  // vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) {
    await supabase.from('routine_shares').update({ status: 'pending' }).eq('id', shareId);
    throw insertError;
  }
}
```

No cambia la firma (`shareId: string): Promise<void>`), ni el comportamiento observable en el caso normal (una sola llamada, sin carrera): igual termina con la propuesta `accepted` y una copia nueva en `routines`.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios.
- Playwright con dos cuentas de prueba conectadas: flujo normal (una sola aceptación) sigue funcionando igual que antes — propuesta pasa a `accepted`, aparece una rutina nueva en "Mis rutinas".
- Simular la carrera real: disparar dos llamadas a `acceptRoutineShare(shareId)` concurrentes (ej. `Promise.allSettled` desde la consola del navegador o un script, no dos clicks humanos que casi nunca son lo bastante simultáneos) contra la misma propuesta pendiente — confirmar que solo se crea **una** copia de la rutina (consulta directa a `routines`) y que una de las dos llamadas efectivamente tira "Esta propuesta ya se resolvió en otro lado.".
- Confirmar que el caso de reversión funciona: si se fuerza que el insert falle (ej. desconectar la red entre el UPDATE y el INSERT, o inspeccionar manualmente que el código de reversión existe y se ejecuta en el `catch`), la propuesta vuelve a `pending` y se puede reintentar.
