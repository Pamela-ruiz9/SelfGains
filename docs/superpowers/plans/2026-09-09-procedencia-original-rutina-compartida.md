# Procedencia original de una rutina reasignada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando una rutina que un entrenador recibió de otro entrenador se reasigna a un tercero, la nueva copia deja de perder de dónde vino originalmente — se sigue mostrando "Compartida por: [último asignador]", pero ahora agrega "(originalmente de [creador original])" cuando corresponde.

**Architecture:** Nueva columna `original_author_name` en `routines` que viaja intacta de salto en salto (no se guarda la cadena completa, solo la raíz). `assignRoutineToStudent` la calcula al insertar cada copia nueva. La UI (`RoutineManager.tsx` → `RoutineList.tsx`) la muestra entre paréntesis solo cuando es distinta del asignador inmediato.

**Tech Stack:** TypeScript/React + Supabase (ya en el stack) — una columna nueva, sin cambio de políticas RLS.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-09-09-procedencia-original-rutina-compartida-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — nueva columna `original_author_name` en `routines` + backfill.
- **Modify:** `src/types/db.ts` — `Routine` gana `original_author_name: string | null`.
- **Modify:** `src/lib/routines.ts` — `assignRoutineToStudent` calcula y guarda el campo nuevo.
- **Modify:** `src/components/react/RoutineManager/RoutineManager.tsx` — pasa el campo nuevo a `RoutineOption`.
- **Modify:** `src/components/react/RoutineManager/RoutineList.tsx` — `RoutineOption` gana el campo, y el JSX lo muestra condicionalmente.

---

### Task 1: Migración de base de datos + tipo `Routine`

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

Agregar al final del archivo:

```sql
-- Procedencia original de una rutina reasignada (2026-09-09): assigned_by_name
-- ya guarda quién te la compartió a VOS directamente; original_author_name
-- guarda quién la creó originalmente, y viaja sin tocar de salto en salto
-- cuando una rutina recibida se reasigna a un tercero (ver
-- docs/superpowers/specs/2026-09-09-procedencia-original-rutina-compartida-design.md).
alter table routines add column original_author_name text;

-- Backfill: para las rutinas ya compartidas antes de este cambio, el único
-- dato de procedencia que existe es assigned_by_name — se usa como mejor
-- aproximación disponible.
update routines set original_author_name = assigned_by_name where assigned_by_name is not null;
```

- [ ] **Step 2: Aplicar la migración contra el proyecto Supabase real**

Escribir el bloque SQL del Step 1 a un archivo temporal (ej. `/tmp/migration.sql`) y correr:

```bash
supabase db query --linked --file /tmp/migration.sql
```

Si el clasificador de permisos de auto-mode bloquea el comando, reportar BLOCKED con el comando exacto para que el usuario lo corra con `!`.

Confirmar que se aplicó:

```bash
supabase db query --linked "select column_name from information_schema.columns where table_name = 'routines' and column_name = 'original_author_name';"
```

Expected: una fila con `original_author_name`.

- [ ] **Step 3: Actualizar el tipo `Routine` en `src/types/db.ts`**

Reemplazar:

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

por:

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

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx` (`Measurement[]` vs. string-index type mismatch, ver `docs/agents/notas-de-entorno-y-lecciones.md`). Ningún otro archivo debería romperse todavía: nada construye un objeto `Routine` literal a mano en este repo (siempre viene de `supabase.from('routines').select('*')`, que ya trae la columna nueva), así que agregar un campo requerido no rompe otros call sites — confirmar igual con `grep -rn "assigned_by_name:" src/` que el único lugar que arma ese campo a mano es `assignRoutineToStudent` (Task 2, todavía no tocado).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/types/db.ts
git commit -m "feat: add original_author_name column to routines"
```

---

### Task 2: Propagar la procedencia original en `assignRoutineToStudent`

**Files:**
- Modify: `src/lib/routines.ts`

- [ ] **Step 1: Reescribir `assignRoutineToStudent`**

Reemplazar:

```ts
export async function assignRoutineToStudent(routineId: string, studentUserId: string): Promise<void> {
  const source = await getRoutineById(routineId);
  if (!source) throw new Error('No se encontró la rutina a asignar.');

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .maybeSingle();

  // Sin .select() a propósito: el entrenador puede INSERTAR una rutina para
  // el alumno (política de RLS de "routines"), pero no puede LEER de vuelta
  // filas que ya son 100% del alumno — pedir la fila insertada de vuelta
  // (Prefer: return=representation) choca contra esa misma política de
  // SELECT y Postgres responde con el mismo error de RLS que si el insert
  // hubiera fallado, aunque el insert en sí se haya hecho con éxito.
  const { error } = await supabase.from('routines').insert({
    user_id: studentUserId,
    name: source.name,
    days: source.days,
    assigned_by_name: myProfile?.display_name ?? 'tu entrenador',
  });

  if (error) throw error;
}
```

por:

```ts
export async function assignRoutineToStudent(routineId: string, studentUserId: string): Promise<void> {
  const source = await getRoutineById(routineId);
  if (!source) throw new Error('No se encontró la rutina a asignar.');

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .maybeSingle();

  const myName = myProfile?.display_name ?? 'tu entrenador';

  // Si la rutina que se está reasignando ya venía compartida (source tiene su
  // propio assigned_by_name), el "original" se propaga tal cual en vez de
  // pisarse con myName — así la copia nueva conserva quién la creó
  // originalmente, no solo quién te la pasó a vos. Si source es una rutina
  // propia (nunca compartida), el asignador actual ES el original.
  const originalAuthorName = source.assigned_by_name
    ? (source.original_author_name ?? source.assigned_by_name)
    : myName;

  // Sin .select() a propósito: el entrenador puede INSERTAR una rutina para
  // el alumno (política de RLS de "routines"), pero no puede LEER de vuelta
  // filas que ya son 100% del alumno — pedir la fila insertada de vuelta
  // (Prefer: return=representation) choca contra esa misma política de
  // SELECT y Postgres responde con el mismo error de RLS que si el insert
  // hubiera fallado, aunque el insert en sí se haya hecho con éxito.
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

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en Task 1 — limpio salvo el error preexistente de `ProgressList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/routines.ts
git commit -m "feat: preserve original author name when reassigning a shared routine"
```

---

### Task 3: Mostrar la procedencia original en la UI

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx`
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`

- [ ] **Step 1: `RoutineList.tsx` — agregar el campo a `RoutineOption`**

Reemplazar:

```ts
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
  recommended?: boolean;
}
```

por:

```ts
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
  originalAuthorName?: string | null;
  recommended?: boolean;
}
```

- [ ] **Step 2: `RoutineList.tsx` — mostrar la procedencia original en el JSX**

Reemplazar:

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

- [ ] **Step 3: `RoutineManager.tsx` — pasar el campo nuevo**

Reemplazar:

```ts
  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
    assignedByName: r.assigned_by_name,
  }));
```

por:

```ts
  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
    assignedByName: r.assigned_by_name,
    originalAuthorName: r.original_author_name,
  }));
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en los tasks anteriores — limpio salvo el error preexistente de `ProgressList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/RoutineManager/RoutineManager.tsx src/components/react/RoutineManager/RoutineList.tsx
git commit -m "feat: show original author when a shared routine was reassigned"
```

---

### Task 4: Verificación manual end-to-end + documentación

**Files:** `docs/agents/procedencia-original-rutina-compartida-status.md` (nuevo)

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio salvo el error preexistente de `ProgressList.tsx`.

- [ ] **Step 2: Matar procesos zombie de corridas anteriores antes de levantar el servidor**

```bash
ps aux | grep -E "astro dev|esbuild" | grep -v grep
```

Matar cualquier proceso que quede de una corrida anterior antes de continuar.

- [ ] **Step 3: Preparar las dos cuentas de prueba**

Reusar `crud-e2e-1786826288@gmail.com` (cuenta A) y `rutinastest1786031687911@gmail.com` (cuenta B) — ya conectadas entre sí de sesiones anteriores (confirmar con `supabase db query --linked "select * from connections where user_a in (select id from auth.users where email in ('crud-e2e-1786826288@gmail.com','rutinastest1786031687911@gmail.com')) or user_b in (...);"` o revisando `/conexiones/` en la UI una vez logueado). Si no están conectadas, reconectarlas con el flujo normal de invitación antes de seguir.

Resetear la contraseña de ambas si hace falta, vía:

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = '<email>';
```

corrido con `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode bloquea el comando, pedirle al usuario que lo corra con `!`.

Confirmar que al menos una de las dos cuentas (usar A) tiene `is_trainer = true`:

```bash
supabase db query --linked "select display_name, is_trainer from profiles where id = (select id from auth.users where email = 'crud-e2e-1786826288@gmail.com');"
```

Si no, activarlo desde Perfil → "Soy entrenador" en la UI antes de seguir. Para el round-trip del Step 5 también hace falta que B tenga `is_trainer = true` (B va a reasignar la rutina de vuelta a A) — confirmar/activar igual que con A.

- [ ] **Step 4: Cuenta A crea una rutina y se la asigna a cuenta B (primer salto)**

Loguear como cuenta A. Ir a `/rutinas/`, crear una rutina custom nueva con un nombre reconocible (ej. "Test Procedencia — {timestamp}"), guardar. Ir a `/conexiones/`, encontrar la conexión con cuenta B, usar el picker de asignar rutina para asignarle la rutina recién creada.

Deslogear cuenta A, loguear cuenta B. Ir a `/rutinas/`, confirmar que la rutina asignada aparece con **"Compartida por: [nombre de A]"**, sin ningún paréntesis (un solo salto — `assigned_by_name === original_author_name`, así que no debería mostrarse la parte "(originalmente de ...)").

- [ ] **Step 5: Cuenta B reasigna esa misma rutina recibida de vuelta a cuenta A (segundo salto)**

Todavía logueado como cuenta B: en `/conexiones/`, usar el picker de asignar rutina — debe listar también la rutina recién recibida de A (el picker no filtra rutinas recibidas, por diseño) — y asignársela de vuelta a la conexión con cuenta A.

Deslogear cuenta B, loguear cuenta A. Ir a `/rutinas/`, encontrar la NUEVA copia (va a haber ahora dos rutinas con el mismo nombre: la original que A creó, y esta copia nueva que le llegó de B) y confirmar que muestra **"Compartida por: [nombre de B] (originalmente de [nombre de A])"** — esto confirma que `original_author_name` viajó intacto en el segundo salto en vez de pisarse con el nombre de B.

Sacar una captura de pantalla de este estado con Playwright.

- [ ] **Step 6: Limpiar las rutinas de prueba**

Borrar, desde `/rutinas/` en cada cuenta, las rutinas de prueba creadas en los Steps 4 y 5 (la original en A, la copia recibida en B, y la copia de vuelta en A) — no dejar datos de prueba acumulados en las cuentas reutilizables. No hace falta desconectar las cuentas (ya estaban conectadas de antes).

- [ ] **Step 7: Documentar la sesión**

Crear `docs/agents/procedencia-original-rutina-compartida-status.md`:

````md
# Procedencia original de una rutina reasignada — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica documentado en `docs/agents/rol-entrenador-status.md` ("Lo que falta"): reasignar una rutina ya recibida de otro entrenador pisaba `assigned_by_name` en silencio, perdiendo la procedencia original. Proceso: spec (`docs/superpowers/specs/2026-09-09-procedencia-original-rutina-compartida-design.md`) → plan (`docs/superpowers/plans/2026-09-09-procedencia-original-rutina-compartida.md`) → implementación con subagent-driven-development.

## Qué se hizo

`routines` ganó una columna `original_author_name`, que viaja intacta de salto en salto en vez de guardarse la cadena completa: `assignRoutineToStudent` (`src/lib/routines.ts`) ahora la calcula — si la rutina que se reasigna nunca fue compartida antes, el asignador actual ES el original; si ya venía compartida, se propaga el `original_author_name` (o `assigned_by_name`) de la rutina origen sin tocar. `assigned_by_name` sigue significando lo mismo de siempre: quién te la compartió a vos directamente. La UI (`RoutineList.tsx`) agrega "(originalmente de X)" a la leyenda "Compartida por: Y" solo cuando ambos nombres difieren — el caso común de un solo salto se ve exactamente igual que antes. Filas existentes se backfillearon con `original_author_name = assigned_by_name` (mejor dato disponible, no se puede reconstruir una cadena que no se trackeaba). No se restringió reasignar rutinas recibidas — sigue permitido, por decisión explícita del usuario.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada task (único error preexistente esperado en `ProgressList.tsx`).
- Playwright con las dos cuentas de prueba reutilizadas (`crud-e2e-1786826288@gmail.com`, `rutinastest1786031687911@gmail.com`, ya conectadas de sesiones anteriores): cuenta A creó una rutina y se la asignó a B — B vio "Compartida por: A" sin paréntesis, confirmando que un solo salto no agrega ruido visual. B reasignó esa misma rutina recibida de vuelta a A — A vio la copia nueva con "Compartida por: B (originalmente de A)", confirmando que la procedencia original viaja intacta en el segundo salto. Rutinas de prueba borradas al terminar.

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): bloquear/advertir al reasignar una rutina recibida, guardar la cadena completa de nombres intermedios (solo se guarda la raíz), sincronizar retroactivamente si alguien cambia su `display_name` después de haber sido citado en una asignación.
````

- [ ] **Step 8: Commit**

```bash
git add docs/agents/procedencia-original-rutina-compartida-status.md
git commit -m "docs: log original-author-name implementation for reassigned routines"
```
