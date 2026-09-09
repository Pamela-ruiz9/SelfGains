# Borrar cuenta desde la UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un usuario logueado puede borrar su cuenta y todos sus datos (entrenamientos, rutinas, medidas, conexiones, foto de perfil) desde un botón en Perfil, sin depender de contactar soporte o tocar la base de datos a mano.

**Architecture:** Una función de Postgres `security definer` (`delete_own_account()`) hace el borrado real de la fila de `auth.users`, acotada siempre a `auth.uid()` — el cascade de FKs ya existente en `supabase/schema.sql` limpia el resto de las tablas. El cliente (`src/lib/profile.ts`) limpia primero la foto de perfil en Storage (que no está en el cascade de FKs) y después invoca esa función vía RPC. La UI (`ProfileForm.tsx`) agrega un botón destructivo con el mismo patrón de `confirm()` que ya usa el resto de la app.

**Tech Stack:** TypeScript/React + Supabase (ya en el stack) — una función SQL nueva, sin cambio de columnas ni tablas.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-09-09-borrar-cuenta-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — función `delete_own_account()` + grants.
- **Modify:** `src/lib/profile.ts` — nueva función `deleteMyAccount()`.
- **Modify:** `src/components/react/Profile/ProfileForm.tsx` — botón "Borrar cuenta" + estado + handler.

---

### Task 1: Función de base de datos

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Agregar la función al final de `supabase/schema.sql`**

```sql
-- Borrar cuenta desde la UI (2026-09-09): el sitio es estático, sin backend
-- propio con privilegios de administrador — esta función permite que un
-- usuario logueado borre su propia fila de auth.users desde el cliente vía
-- supabase.rpc('delete_own_account'). Acotada a auth.uid(): no recibe ningún
-- id como parámetro, así que no hay forma de que un usuario borre la cuenta
-- de otro. Todas las tablas con datos de usuario ya tienen
-- "on delete cascade" hacia auth.users, así que esta sola fila arrastra todo
-- lo demás (workouts, routines, profiles, connections, etc.) — la foto de
-- perfil en Storage es la única excepción y se limpia aparte, desde el
-- cliente, antes de llamar a esta función (ver src/lib/profile.ts).
create or replace function delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;
```

- [ ] **Step 2: Aplicar la migración contra el proyecto Supabase real**

Escribir el bloque SQL del Step 1 a un archivo temporal (ej. `/tmp/migration.sql`) y correr:

```bash
supabase db query --linked --file /tmp/migration.sql
```

Si el clasificador de permisos de auto-mode bloquea el comando, reportar BLOCKED con el comando exacto para que el usuario lo corra con `!`.

Confirmar que se creó:

```bash
supabase db query --linked "select proname, prosecdef from pg_proc where proname = 'delete_own_account';"
```

Expected: una fila, `prosecdef` en `true` (confirma que quedó marcada `security definer`).

Confirmar los grants:

```bash
supabase db query --linked "select grantee, privilege_type from information_schema.routine_privileges where routine_name = 'delete_own_account';"
```

Expected: una fila con `grantee = authenticated`, `privilege_type = EXECUTE`. No debería aparecer ninguna fila con `grantee = PUBLIC` (confirma que el `revoke` funcionó).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add delete_own_account RPC function"
```

---

### Task 2: Lógica de eliminación (`src/lib/profile.ts`)

**Files:**
- Modify: `src/lib/profile.ts`

- [ ] **Step 1: Agregar `deleteMyAccount()` al final del archivo**

```ts

// Borra la cuenta del usuario logueado y todos sus datos relacionados. La
// foto de perfil (Storage) no está en el cascade de FKs de Postgres, así que
// se limpia acá aparte, best-effort — si falla, no bloquea el borrado de la
// cuenta (una foto huérfana en un bucket público no expone nada sensible).
// El resto de las tablas de usuario (workouts, routines, profiles,
// connections, etc.) ya tienen "on delete cascade" hacia auth.users, así que
// borrar esa fila vía el RPC de abajo limpia todo lo demás automáticamente.
export async function deleteMyAccount(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data: files } = await supabase.storage.from('avatars').list(user.id);
  if (files && files.length > 0) {
    await supabase.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx` (a `Measurement[]` vs. string-index type mismatch — confirmed pre-existing, unrelated, no lo arregles).

- [ ] **Step 3: Commit**

```bash
git add src/lib/profile.ts
git commit -m "feat: add deleteMyAccount to clean up avatar and call delete_own_account RPC"
```

---

### Task 3: UI (`ProfileForm.tsx`)

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx`

- [ ] **Step 1: Agregar `deleteMyAccount` al import existente**

Reemplazar:

```ts
import { getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
```

por:

```ts
import { deleteMyAccount, getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
```

- [ ] **Step 2: Agregar el estado `deletingAccount`**

Reemplazar:

```ts
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
```

por:

```ts
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
```

- [ ] **Step 3: Agregar el handler `handleDeleteAccount`, justo después de `handleLogout`**

Reemplazar:

```ts
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = import.meta.env.BASE_URL;
  }
```

por:

```ts
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = import.meta.env.BASE_URL;
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        '¿Eliminar tu cuenta? Esto borra todos tus entrenamientos, rutinas, medidas y conexiones de forma permanente. Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    setDeletingAccount(true);
    setError(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      window.location.href = import.meta.env.BASE_URL;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la cuenta.');
      setDeletingAccount(false);
    }
  }
```

- [ ] **Step 4: Agregar el botón y su mensaje de error, después de "Cerrar sesión"**

Reemplazar:

```tsx
      <button
        type="button"
        onClick={handleLogout}
        className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
      >
        Cerrar sesión
      </button>
    </div>
  );
```

por:

```tsx
      <button
        type="button"
        onClick={handleLogout}
        className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
      >
        Cerrar sesión
      </button>

      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={deletingAccount}
        className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95 disabled:opacity-50"
      >
        {deletingAccount ? 'Borrando...' : 'Borrar cuenta'}
      </button>
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
    </div>
  );
```

Nota: el mensaje de error se reutiliza (`error`/`setError`) del mismo estado que ya usa el formulario de arriba — se agrega una segunda instancia de su render acá, cerca del botón nuevo, porque el render que ya existe (dentro del `<form>`, antes de "Guardar perfil") queda visualmente lejos de este botón y confundiría a un usuario que hizo click en "Borrar cuenta" y ve el error aparecer arriba del todo. Ambos renders leen el mismo estado, así que no hace falta lógica adicional — un error de cualquiera de las dos acciones se muestra en su lugar correspondiente sin duplicarse en el otro (cada `{error && ...}` solo se pinta si el usuario está viendo esa parte del formulario en ese momento, y ambos desaparecen juntos en el próximo intento exitoso porque comparten el mismo `setError(null)`).

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en Task 2 — limpio salvo el error preexistente de `ProgressList.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "feat: add delete-account button to Perfil"
```

---

### Task 4: Verificación manual end-to-end + documentación

**Files:** `docs/agents/borrar-cuenta-status.md` (nuevo)

**Importante:** esta verificación borra una cuenta de verdad (es irreversible por diseño) — a diferencia de otras rondas de este proyecto, NO se puede usar ninguna de las cuentas reutilizables existentes (`crud-e2e-1786826288@gmail.com`, `rutinastest1786031687911@gmail.com`). Hace falta crear una cuenta de prueba nueva, desechable, solo para este test.

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio salvo el error preexistente de `ProgressList.tsx`.

- [ ] **Step 2: Matar procesos zombie de corridas anteriores antes de levantar el servidor**

```bash
ps aux | grep -E "astro dev|esbuild" | grep -v grep
```

Matar cualquier proceso que quede de una corrida anterior antes de continuar.

- [ ] **Step 3: Crear la cuenta de prueba desechable**

Crear un usuario nuevo y confirmarlo directamente por SQL (evita el rate-limit de emails de Supabase, y evita necesitar la service-role key — ver `docs/agents/notas-de-entorno-y-lecciones.md`):

```sql
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'borrar-cuenta-test-<timestamp>@example.com',
  crypt('<password-elegido>', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

corrido con `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode bloquea el comando, pedirle al usuario que lo corra con `!`. Si este `insert` directo a `auth.users` no funciona tal cual (puede haber columnas NOT NULL adicionales según la versión de Supabase Auth), ajustarlo según el error devuelto — es una operación de una sola vez, no necesita ser perfecta al primer intento.

- [ ] **Step 4: Loguear y crear datos de prueba**

Con el servidor de dev corriendo, loguear con la cuenta nueva. Ir a Perfil, subir cualquier foto de prueba (confirmar que se sube y se ve). Ir a `/rutinas/`, crear una rutina custom cualquiera. Ir a `/registro/nuevo/`, loguear cualquier entrenamiento simple.

Antes de borrar, confirmar contra la base real que los datos quedaron (para poder comparar después):

```bash
supabase db query --linked "select (select count(*) from routines where user_id = u.id) as routines, (select count(*) from workouts where user_id = u.id) as workouts from auth.users u where email = 'borrar-cuenta-test-<timestamp>@example.com';"
```

Expected: ambos conteos en 1 o más.

```bash
supabase db query --linked "select name from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = (select id::text from auth.users where email = 'borrar-cuenta-test-<timestamp>@example.com');"
```

Expected: al menos una fila (el archivo de la foto subida).

- [ ] **Step 5: Borrar la cuenta desde la UI**

Ir a Perfil, click en "Borrar cuenta". Confirmar el diálogo del navegador. Verificar visualmente (captura de pantalla con Playwright) que redirige a la raíz del sitio y que la sesión quedó cerrada (ej. intentar ir a `/perfil/` de nuevo y ver que pide loguearse).

- [ ] **Step 6: Confirmar el borrado contra la base real**

```bash
supabase db query --linked "select count(*) from auth.users where email = 'borrar-cuenta-test-<timestamp>@example.com';"
```

Expected: `0`.

```bash
supabase db query --linked "select count(*) from storage.objects where bucket_id = 'avatars' and name like '%borrar-cuenta-test%';"
```

(Si el nombre de archivo no incluye el email, usar en cambio el `user_id` guardado del Step 3/4 antes de que la cuenta se borre.) Expected: `0` — confirma que el avatar se limpió, no solo la fila de `auth.users`.

Repetir el conteo del Step 4 para `routines`/`workouts` — como la cuenta ya no existe, la forma más simple es confirmar directamente que no queda ninguna fila con ese `user_id` guardado de antemano:

```bash
supabase db query --linked "select count(*) from routines where user_id = '<user_id guardado del Step 3>' union all select count(*) from workouts where user_id = '<user_id guardado del Step 3>';"
```

Expected: ambos en `0`.

- [ ] **Step 7: Documentar la sesión**

Crear `docs/agents/borrar-cuenta-status.md`:

````md
# Borrar cuenta desde la UI — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica documentado en `docs/agents/perfil-y-personalizacion-status.md` ("Lo que falta"): "sin borrar la cuenta desde la UI (solo logout)". Proceso: spec (`docs/superpowers/specs/2026-09-09-borrar-cuenta-design.md`) → plan (`docs/superpowers/plans/2026-09-09-borrar-cuenta.md`) → implementación con subagent-driven-development.

## Qué se hizo

Se agregó una función de Postgres `delete_own_account()` (`security definer`, acotada a `auth.uid()`, sin recibir ningún id como parámetro) que borra la fila de `auth.users` del usuario autenticado — el cascade de FKs ya existente en el schema limpia automáticamente `workouts`, `routines`, `profiles`, `connections`, y el resto de las tablas de usuario. `deleteMyAccount()` en `src/lib/profile.ts` primero limpia la foto de perfil en Storage (que no está en el cascade de FKs de Postgres) y después invoca esa función vía `supabase.rpc(...)`. La UI (`ProfileForm.tsx`) agrega un botón "Borrar cuenta" con el mismo `confirm()` nativo que ya usa el resto de acciones destructivas de la app (rutinas, sesiones, conexiones) — se decidió explícitamente no introducir un patrón de confirmación distinto solo para esta acción.

## Verificación

[Completar con lo realmente observado: nombre/email de la cuenta de prueba desechable creada, conteos exactos antes/después, confirmación de que el archivo de Storage se limpió.]

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): periodo de gracia o borrado suave, exportar datos antes de borrar, reautenticación con contraseña antes de confirmar, notificación por email del borrado. Los otros dos ítems de deuda técnica de Perfil (recorte de foto, editar/borrar medidas del historial) siguen pendientes, sin tocar en esta ronda.
````

Completá la sección "Verificación" con el detalle real (no dejes el placeholder entre corchetes).

- [ ] **Step 8: Commit**

```bash
git add docs/agents/borrar-cuenta-status.md
git commit -m "docs: log delete-account implementation"
```
