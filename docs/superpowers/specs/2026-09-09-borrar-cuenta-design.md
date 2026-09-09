# Borrar cuenta desde la UI — diseño

Ítem de deuda técnica documentado en `docs/agents/perfil-y-personalizacion-status.md` ("Lo que falta"): "sin borrar la cuenta desde la UI (solo logout)". Esta ronda lo cierra.

## Alcance

Un botón nuevo en Perfil que borra permanentemente la cuenta del usuario logueado y todos sus datos (entrenamientos, rutinas, medidas, conexiones). No incluye recorte de foto ni edición del historial de medidas — son ítems separados del mismo backlog, cada uno con su propia ronda.

## Por qué hace falta una función de base de datos

El sitio es 100% estático (`output: 'static'` en `astro.config.mjs`, confirmado en specs anteriores) — no hay backend propio que pueda correr una eliminación con privilegios elevados. El cliente de Supabase no puede borrar la propia fila de `auth.users` directamente (requiere privilegios de administrador que nunca se exponen al navegador). La solución estándar de Supabase para "que un usuario borre su propia cuenta" desde un cliente sin backend es una función de Postgres `security definer` — corre con privilegios elevados, pero está escrita para hacer una sola cosa acotada: borrar la fila de `auth.users` cuyo `id` sea el del usuario autenticado que la invoca. Un usuario nunca puede pasarle el id de otro; no hay ningún parámetro, siempre usa `auth.uid()` internamente.

Todas las tablas con datos de usuario (`workouts`, `routines`, `profiles`, `connections`, `invite_codes`, `active_routines`, etc.) ya tienen `references auth.users(id) on delete cascade` — confirmado repasando `supabase/schema.sql`. Borrar esa única fila de `auth.users` limpia automáticamente todo lo demás; no hace falta borrar tabla por tabla.

**Excepción: la foto de perfil.** Vive en Supabase Storage (bucket `avatars`, `{user_id}/avatar.<ext>`), y Storage no está integrado al cascade de FKs de Postgres — borrar la fila de `auth.users` no borra el archivo. Si no se limpia aparte, queda huérfano en el bucket para siempre. Se decidió limpiarlo explícitamente como parte del flujo (ver sección 2).

## 1. Función de base de datos (`supabase/schema.sql`)

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

`set search_path = ''` es hardening estándar para funciones `security definer`: obliga a que toda referencia dentro del cuerpo esté completamente calificada (`auth.users`, `auth.uid()`, ambas ya lo están), evitando que alguien manipule el `search_path` de la sesión para redirigir una referencia sin calificar hacia un objeto malicioso.

## 2. Lógica de eliminación (`src/lib/profile.ts`)

Función nueva `deleteMyAccount()`, que:
1. Lista los archivos en `avatars/{user_id}/` y los borra si existen — best-effort, un error acá no bloquea el borrado de la cuenta (una foto huérfana es un problema menor comparado con no poder borrar la cuenta).
2. Llama a `supabase.rpc('delete_own_account')`.
3. Si el RPC falla, propaga el error (la UI lo muestra y no continúa con el logout/redirect).

```ts
export async function deleteMyAccount(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  // Best-effort: la foto no está en el cascade de FKs de Postgres (vive en
  // Storage), así que se limpia aparte. Si falla, no bloquea el borrado de
  // la cuenta — una foto huérfana en un bucket público no es un problema
  // grave comparado con no poder borrar la cuenta.
  const { data: files } = await supabase.storage.from('avatars').list(user.id);
  if (files && files.length > 0) {
    await supabase.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
```

## 3. UI (`ProfileForm.tsx`)

Un botón nuevo "Borrar cuenta", mismo estilo destructivo que ya usan "Cerrar sesión" y "Eliminar" (rutinas): `border-2 border-blood ... text-blood ... hover:bg-blood hover:text-paper`. Se ubica debajo de "Cerrar sesión".

```tsx
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

```tsx
<button
  type="button"
  onClick={handleDeleteAccount}
  disabled={deletingAccount}
  className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95 disabled:opacity-50"
>
  {deletingAccount ? 'Borrando...' : 'Borrar cuenta'}
</button>
```

Se agrega el estado `deletingAccount` (`useState(false)`) junto a los demás estados de carga del componente (`saving`, `uploadingPhoto`), y se importa `deleteMyAccount` desde `../../../lib/profile`. El `confirm()` nativo del navegador es intencional — es el mismo patrón que ya usa el resto de las acciones destructivas de la app (`RoutineManager.tsx`, `WorkoutHistory.tsx`, `Connections.tsx`), decidido explícitamente para mantener consistencia en vez de introducir un patrón de confirmación nuevo solo para esta acción.

Errores se muestran con el mismo `error`/`setError` que ya usa el resto del formulario (no hace falta un estado de error separado).

## Casos borde

- **Usuario sin foto subida nunca:** `list()` devuelve un array vacío, no hay nada que borrar, sin error.
- **Falla de red a mitad del RPC:** el `DELETE` es una sola sentencia SQL atómica — o borra la fila completa (con todo su cascade) o no borra nada; no hay estado intermedio de "cuenta borrada a medias". Un error de red antes de que el RPC complete simplemente dejaría la cuenta intacta, y el usuario ve el mensaje de error para reintentar.
- **Entrenador con alumnos conectados:** las rutinas que asignó ya son copias de propiedad completa en la cuenta del alumno (sin FK de vuelta al entrenador, `assigned_by_name`/`original_author_name` son solo texto) — no se ven afectadas por el borrado. Solo desaparecen las filas propias de `connections`/`invite_codes` del entrenador (por cascade), y el alumno deja de ver a ese entrenador en su lista de conexiones.
- **Fallo al borrar el avatar pero éxito en el RPC:** aceptado — la cuenta y todos sus datos relacionales se borran igual; un archivo huérfano en el bucket público `avatars` no expone nada sensible (ya es público por diseño, ver `supabase/schema.sql` línea ~134).

## Explícitamente fuera de esta ronda

- Recorte/ajuste de la foto de perfil al subirla — ítem separado del backlog.
- Editar/borrar filas del historial de medidas — ítem separado del backlog.
- Periodo de gracia o borrado suave (soft delete) — el borrado es inmediato y permanente, sin ventana de arrepentimiento.
- Exportar los datos del usuario antes de borrar la cuenta — no pedido, no se agrega.
- Reautenticación con contraseña antes de confirmar (ej. "ingresá tu contraseña para confirmar") — se decidió mantener el mismo `confirm()` simple que ya usa el resto de acciones destructivas de la app.
- Notificación por email confirmando que la cuenta se borró — no pedido, no se agrega.

## Verificación

Igual que el resto del proyecto: sin suite automatizada. `npm run build` + `npx tsc --noEmit` limpios (ignorando el error preexistente ya documentado en `ProgressList.tsx`, no relacionado). Playwright contra Supabase real con una cuenta de prueba desechable (crear una nueva específicamente para este test, ya que el borrado es irreversible y no se puede usar ninguna de las cuentas reutilizables existentes): loguear, subir una foto de perfil, crear al menos un entrenamiento/rutina, ir a Perfil, click en "Borrar cuenta", confirmar el diálogo, verificar que redirige a la raíz del sitio y que la sesión quedó cerrada. Confirmar contra la base real que la fila de `auth.users` ya no existe, que las tablas relacionadas (`workouts`, `routines`, `profiles`) no tienen filas para ese `user_id`, y que el archivo en `avatars/{user_id}/` ya no está listado.
