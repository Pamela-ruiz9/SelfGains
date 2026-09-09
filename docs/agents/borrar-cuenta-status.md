# Borrar cuenta desde la UI — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica documentado en `docs/agents/perfil-y-personalizacion-status.md` ("Lo que falta"): "sin borrar la cuenta desde la UI (solo logout)". Proceso: spec (`docs/superpowers/specs/2026-09-09-borrar-cuenta-design.md`) → plan (`docs/superpowers/plans/2026-09-09-borrar-cuenta.md`) → implementación con subagent-driven-development.

## Qué se hizo

Se agregó una función de Postgres `delete_own_account()` (`security definer`, `plpgsql`, acotada a `auth.uid()`, sin recibir ningún id como parámetro, y endurecida durante la revisión de código para levantar una excepción en vez de fallar en silencio si por algún motivo no borra ninguna fila) que borra la fila de `auth.users` del usuario autenticado — el cascade de FKs ya existente en el schema limpia automáticamente `workouts`, `routines`, `profiles`, `connections`, y el resto de las tablas de usuario. `deleteMyAccount()` en `src/lib/profile.ts` primero limpia la foto de perfil en Storage (que no está en el cascade de FKs de Postgres) y después invoca esa función vía `supabase.rpc(...)`. La UI (`ProfileForm.tsx`) agrega un botón "Borrar cuenta" con el mismo `confirm()` nativo que ya usa el resto de acciones destructivas de la app, con su propio estado de error dedicado (no comparte el estado de error genérico del formulario, para que un fallo de otra acción de la página nunca se vea como si hubiera fallado el borrado de cuenta).

**Nota sobre revisión de código:** el permiso `EXECUTE` de la función tuvo que endurecerse en dos rondas adicionales después de la implementación inicial — Supabase otorga `EXECUTE` por default a `postgres`/`anon`/`authenticated`/`service_role` en cada función nueva vía ACLs de rol explícitas, no vía el pseudo-rol `PUBLIC`, así que el `revoke ... from public` original no alcanzaba; se agregaron revokes explícitos para `anon` y `service_role`. Ninguna de las dos rondas era explotable (ver commits `59f59d3`, `8968066`, `9ddb921`), pero se corrigieron por buena higiene de seguridad antes de continuar.

## Verificación

Verificación manual end-to-end contra Supabase real (Playwright headless + servidor de dev local), siguiendo el plan de Task 4.

**Build y tipos:** `npm run build` limpio; `npx tsc --noEmit` solo con el error preexistente y no relacionado de `ProgressList.tsx:183` (`Measurement[]` vs. índice de string) — confirmado como no relacionado a esta feature.

**Cuenta de prueba desechable creada** (nunca una de las cuentas reutilizables del repo):
- Email: `borrar-cuenta-test-1788996018@example.com`
- `user_id`: `1aa5e560-3e0a-408c-b35a-b725c37ca849`
- Creada e insertada directamente por SQL (`insert into auth.users ...` + `insert into auth.identities ...`, corrido con `supabase db query --linked --file`) para evitar el rate-limit de emails y no necesitar la service-role key. El primer intento funcionó sin necesidad de iterar: `auth.users` solo exige `id` como `NOT NULL` sin default (el resto de columnas son nullable o tienen default), y el login por email/password sí requirió la fila correspondiente en `auth.identities` (con `provider = 'email'`, `provider_id` = el mismo `user_id`, e `identity_data` con `sub`/`email`/flags de verificación) — sin esa fila el insert en `auth.users` solo no hubiera alcanzado para loguear.

**Datos de prueba creados vía UI, antes de borrar:**
- Foto de perfil: subida en Perfil, confirmada visualmente (avatar circular verde reemplazó el ícono por defecto en el header y en la card de perfil).
- Rutina custom: "Rutina de prueba borrar-cuenta" creada desde Rutinas → "+ Agregar nueva rutina" → pestaña "Crear la mía" (solo con nombre, sin días asignados) → apareció en "Mis rutinas".
- Entrenamiento: registrado desde `/registro/nuevo/` (1 serie de "Abductor en máquina", 10 reps × 20 kg) → mensaje de confirmación "Entrenamiento guardado correctamente. ¡Nuevo PR en Abductor en máquina (20 kg)!".

Conteos contra la base real antes de borrar:
```
routines = 1, workouts = 1
storage.objects (bucket avatars, carpeta del user_id) = 1 fila ("1aa5e560-.../avatar.png")
```

**Caso de error probado primero (Step 5):** click en "Borrar cuenta" → apareció el `confirm()` nativo con el texto "¿Eliminar tu cuenta? Esto borra todos tus entrenamientos, rutinas, medidas y conexiones de forma permanente. Esta acción no se puede deshacer." → se hizo dismiss (equivalente a "Cancelar"). Resultado: la página se quedó en `/perfil/` sin cambios, la sesión siguió activa, y `select count(*) from auth.users where id = '...'` siguió devolviendo `1` — el `confirm()` sí gatea la acción, no hay ningún camino que borre sin confirmación explícita.

**Borrado real (Step 6):** click en "Borrar cuenta" de nuevo, esta vez aceptando el diálogo. Redirigió automáticamente a la raíz del sitio (`http://localhost:4321/SelfGains/`, confirmado por URL y captura de pantalla). Al navegar de nuevo a `/perfil/` en la misma pestaña, se mostró "Debes iniciar sesión para ver tu perfil." — la sesión quedó cerrada correctamente, no solo redirigida.

**Confirmación contra la base real después de borrar (Step 7):**
```
select count(*) from auth.users where id = '1aa5e560-3e0a-408c-b35a-b725c37ca849';         → 0
select count(*) from routines where user_id = '...' union all
select count(*) from workouts where user_id = '...';                                        → 0, 0
select count(*) from storage.objects where bucket_id = 'avatars'
  and (storage.foldername(name))[1] = '1aa5e560-3e0a-408c-b35a-b725c37ca849';               → 0
```

Los tres conteos en cero confirman: la fila de `auth.users` se borró, el cascade de FKs limpió `routines` y `workouts` (y por extensión el resto de tablas de usuario que dependen del mismo mecanismo), y el archivo de avatar en Storage —que no está cubierto por ningún cascade de Postgres— se limpió correctamente por el paso explícito de `deleteMyAccount()`.

No quedó ningún dato de prueba pendiente de limpiar: la cuenta desechable, sus filas relacionadas y su archivo de Storage ya no existen en la base real.

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): periodo de gracia o borrado suave, exportar datos antes de borrar, reautenticación con contraseña antes de confirmar, notificación por email del borrado. Los otros dos ítems de deuda técnica de Perfil (recorte de foto, editar/borrar medidas del historial) siguen pendientes, sin tocar en esta ronda.
