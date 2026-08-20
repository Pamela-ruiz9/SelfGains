# Constraint único en routine_shares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No se puede tener dos propuestas *pendientes* de la misma rutina a la misma persona a la vez; el intento duplicado falla con un mensaje claro en vez de un error crudo de Postgres o una fila duplicada. Re-proponer la misma rutina después de que una propuesta anterior se aceptó o rechazó sigue funcionando.

**Architecture:** Un índice único parcial en `routine_shares` (`unique (routine_id, to_user_id) where status = 'pending'`) hace el trabajo de bloqueo a nivel de base de datos. `proposeRoutineShare()` en `src/lib/routineShares.ts` traduce el código de error `23505` (violación de unique) a un mensaje en español; la UI que ya consume esa función (`ShareRoutinePicker` en `RoutineList.tsx`) no cambia, porque ya muestra `err.message` de cualquier error que reciba.

**Tech Stack:** Supabase (Postgres + RLS, ya en el stack) — sin dependencias nuevas, sin cambio de UI.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-20-routine-shares-unique-constraint-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — índice único parcial nuevo en `routine_shares`.
- **Modify:** `src/lib/routineShares.ts` — `proposeRoutineShare` traduce el error de duplicado.

---

### Task 1: Migración + mensaje de error claro

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/routineShares.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

```sql

-- Constraint único en routine_shares
-- (docs/superpowers/specs/2026-08-20-routine-shares-unique-constraint-design.md).
-- Parcial (solo pending) para no bloquear re-proponer la misma rutina
-- después de que una propuesta anterior se aceptó o rechazó.
create unique index routine_shares_no_duplicate_pending
  on routine_shares (routine_id, to_user_id)
  where status = 'pending';
```

- [ ] **Step 2: Aplicar la migración contra el proyecto real**

Escribir el bloque SQL de arriba a un archivo y correrlo:

```bash
supabase db query --linked --file <archivo.sql>
```

Si el clasificador de permisos bloquea el comando, pedirle al usuario que lo corra con el prefijo `!`.

- [ ] **Step 3: Verificar que el índice existe**

```bash
supabase db query --linked "select indexname, indexdef from pg_indexes where tablename = 'routine_shares' and indexname = 'routine_shares_no_duplicate_pending';"
```

Expected: una fila, con `indexdef` mostrando `WHERE (status = 'pending'::text)`.

- [ ] **Step 4: Traducir el error de duplicado en `proposeRoutineShare`**

Reemplazar:

```ts
export async function proposeRoutineShare(routineId: string, toUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('routine_shares')
    .insert({ routine_id: routineId, from_user_id: user.id, to_user_id: toUserId });
  if (error) throw error;
}
```

por:

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

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/lib/routineShares.ts
git commit -m "fix: prevent duplicate pending routine share proposals"
```

---

### Task 2: Verificación manual end-to-end + documentación

**Files:** `docs/roadmap-ideas.md`, `docs/agents/routine-shares-unique-constraint-status.md` (nuevo)

**Contexto:** este flujo necesita dos cuentas conectadas entre sí (compartir una rutina requiere una conexión existente). Sesiones anteriores ya dejaron `crud-e2e-1786826288@gmail.com` y `rutinastest1786031687911@gmail.com` conectadas y reutilizables (ver `docs/agents/descubrimiento-conexiones-status.md`) — si al loguear resulta que ya no están conectadas (se desvincularon en alguna sesión posterior), conectarlas de nuevo antes de seguir (vía código de invitación, generado desde el Perfil de una de las dos).

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en el Task 1.

- [ ] **Step 2: Preparar las dos cuentas de prueba**

Mismo patrón que sesiones anteriores (ver `docs/agents/notas-de-entorno-y-lecciones.md`): escribir a un archivo y correr, para cada cuenta,

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
UPDATE auth.users SET encrypted_password = crypt('<otra-clave>', gen_salt('bf')) WHERE email = 'rutinastest1786031687911@gmail.com';
```

vía `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode lo bloquea, pedirle al usuario que lo corra con `!`.

- [ ] **Step 3: Playwright — duplicado bloqueado con mensaje claro**

Con `npx astro preview` corriendo (build ya hecho en Step 1): loguear como `crud-e2e-1786826288@gmail.com` (cuenta A), ir a `/rutinas/`, elegir cualquier rutina propia en "Mis rutinas", click "Compartir", elegir a `rutinastest1786031687911@gmail.com` (cuenta B) de la lista de conexiones. Confirmar que dice "Propuesta enviada." Volver a intentar compartir la **misma** rutina a la **misma** cuenta B (abrir "Compartir" de nuevo en esa rutina) — confirmar que ahora aparece el mensaje "Ya le propusiste esta rutina y sigue pendiente." en vez de "Propuesta enviada." o un error genérico.

- [ ] **Step 4: Playwright — re-proponer después de resolver funciona**

Loguear como cuenta B, ir a `/conexiones/`, en "Rutinas compartidas pendientes" click "Rechazar" sobre la propuesta de A del Step 3. Volver a loguear como cuenta A, repetir el intento de compartir esa misma rutina a esa misma cuenta B — confirmar que esta vez sí dice "Propuesta enviada." (el rechazo liberó el índice único parcial).

- [ ] **Step 5: Restaurar el estado de las cuentas de prueba**

Si quedó alguna propuesta pendiente sin resolver entre A y B por los Steps 3-4, rechazarla desde la cuenta B para no dejar basura de prueba acumulada para la próxima sesión que reuse estas cuentas.

- [ ] **Step 6: Actualizar la documentación de la sesión**

En `docs/roadmap-ideas.md`, dentro del bullet de **Conexiones**, sacar la parte ya resuelta. Reemplazar:

```md
- **Conexiones** (`descubrimiento-conexiones-status.md`, `dividir-connections-status.md`): `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones simultáneas (borde muy angosto, sin corrupción de datos); `routine_shares` no tiene constraint único, se puede proponer la misma rutina dos veces.
```

por:

```md
- **Conexiones** (`descubrimiento-conexiones-status.md`, `dividir-connections-status.md`, `routine-shares-unique-constraint-status.md`): `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones simultáneas (borde muy angosto, sin corrupción de datos).
```

Crear `docs/agents/routine-shares-unique-constraint-status.md`:

````md
# Constraint único en routine_shares — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — se podía proponer la misma rutina dos veces a la misma persona (ej. doble click en "Compartir"), sin ningún constraint que lo evite. Elegido directamente por el usuario de la lista de deuda técnica. Proceso: brainstorming (una sola pregunta: qué tan estricto debía ser el bloqueo) → spec (`docs/superpowers/specs/2026-08-20-routine-shares-unique-constraint-design.md`) → plan (`docs/superpowers/plans/2026-08-20-routine-shares-unique-constraint.md`) → implementación con subagent-driven-development.

## Qué se hizo

Índice único parcial en `routine_shares`, solo sobre filas `pending`:

```sql
create unique index routine_shares_no_duplicate_pending
  on routine_shares (routine_id, to_user_id)
  where status = 'pending';
```

Al ser parcial (no un constraint de tabla completa), una vez que una propuesta se acepta o rechaza deja de contar — se puede volver a proponer la misma rutina a la misma persona más adelante sin problema. `proposeRoutineShare()` (`src/lib/routineShares.ts`) ahora traduce el código de error `23505` (violación de unique) a "Ya le propusiste esta rutina y sigue pendiente." en vez de dejar pasar el error crudo de Postgres. La UI (`ShareRoutinePicker` en `RoutineList.tsx`) no necesitó ningún cambio — ya mostraba `err.message` de cualquier error recibido.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (único error preexistente esperado en `ProgressList.tsx`).
- Migración aplicada y verificada contra la base real (`pg_indexes`).
- Playwright con dos cuentas de prueba conectadas: proponer la misma rutina dos veces seguidas mientras la primera sigue pendiente → la segunda muestra el mensaje claro de duplicado, no crea una fila nueva; rechazar la propuesta y volver a proponer la misma rutina a la misma persona → funciona sin error.

## Lo que falta / no cubierto en esta ronda

- La condición de carrera en `acceptRoutineShare` (dos sesiones simultáneas aceptando la misma propuesta) sigue sin resolver — es un ítem separado de la lista de deuda técnica, no se tocó acá.
````

- [ ] **Step 7: Commit**

```bash
git add docs/roadmap-ideas.md docs/agents/routine-shares-unique-constraint-status.md
git commit -m "docs: log routine_shares unique constraint fix"
```
