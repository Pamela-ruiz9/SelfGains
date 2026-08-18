# Rol de entrenador + conexiones entre usuarios — diseño

Primer ítem del backlog de negocio (`docs/roadmap-ideas.md`) que se ataca, elegido explícitamente por el usuario. El diseño terminó generalizando el pedido original ("un entrenador le pone rutinas a su alumno") en un concepto más amplio de **conexión entre dos usuarios con consentimiento mutuo**, del cual el rol de entrenador es una capacidad extra — porque a mitad del brainstorming el usuario pidió que cualquier par de usuarios pueda compartir su perfil entre sí, no solo entrenador↔alumno, y no tenía sentido construir dos mecanismos de invitación distintos para dos formas del mismo problema.

**Pedido:**
- Cualquier usuario puede activar "Soy entrenador" en su Perfil.
- Cualquier usuario (entrenador o no) puede generar un link corto para compartir su perfil con otro usuario; el otro usuario lo abre y, con eso, quedan conectados.
- Toda conexión otorga, por default, verse el perfil básico (nombre, avatar, medidas) entre los dos — sin importar quién generó el link.
- Si uno de los dos conectados es entrenador, además puede crearle rutinas directamente al otro — aparecen en "Mis rutinas" del receptor como una rutina más, totalmente editable/borrable por él, sin ningún vínculo de vuelta al entrenador salvo una leyenda "Compartida por: [nombre]" en la propia rutina.
- El avatar de un entrenador lleva un distintivo visual donde se muestre.

**Explícitamente fuera de esta ronda:**
- Ver el historial de entrenamientos/Progreso del otro usuario — la conexión solo comparte perfil básico (nombre, avatar, medidas), no `workouts`/`workout_sets`/`workout_sessions`/`measurements`.
- "Perfil enriquecido" (sexo, nivel de entrenamiento) — ítem separado del backlog, no se toca.
- Buscador de entrenadores cercanos (mapa/geolocalización) — ítem separado del backlog.
- Aprobación/moderación de quién puede ser entrenador — es autodeclarado, sin revisión.
- Límite a un solo entrenador por alumno, o a una sola conexión por usuario — son muchos a muchos, sin restricción.
- Sincronización retroactiva de una rutina asignada si el entrenador edita su original después — cada asignación es una copia independiente congelada al momento de asignar.

## Enfoque técnico elegido

**Todo pasa por una sola tabla de conexión genérica y un solo mecanismo de invitación**, reusado tanto para "compartir mi perfil con un amigo" como para "conectarme con mi entrenador" — son el mismo flujo de consentimiento, la única diferencia es si alguno de los dos lados tiene `is_trainer = true` en el momento de chequear el permiso (no se guarda como un flag aparte en la conexión, se lee en el momento vía `profiles.is_trainer`). Esto evita construir dos sistemas de invitación paralelos para resolver el mismo problema de consentimiento.

**Asignación de rutina = copia de fila, no referencia.** El entrenador arma su rutina con el mismo `CreateRoutineForm` que ya existe para rutinas propias (cero cambios ahí); una acción nueva "Asignar" hace un `insert` normal en `routines` con `user_id` del receptor, mismo patrón `supabase.from(...).insert(...)` que usa el resto del proyecto — sin ninguna función RPC de Postgres nueva, siguiendo la convención existente del repo.

**Links cortos sobre un sitio 100% estático.** El proyecto es `output: 'static'` (GitHub Pages, confirmado en `astro.config.mjs`) — no hay rutas dinámicas server-side posibles para un código que se genera en runtime. La solución es un código corto (6 caracteres) más una única página estática fija (`src/pages/c.astro`) que lee el código de un **fragmento hash** (`#AB3F9K`, nunca llega al servidor, no necesita configuración de hosting) en vez de un parámetro de ruta.

## 1. Modelo de datos

`profiles` gana una columna:

```sql
alter table profiles add column is_trainer boolean not null default false;
```

Tabla nueva `invite_codes` — cualquier usuario puede tener una, se crea la primera vez que toca "Compartir mi perfil":

```sql
create table invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "Cualquier usuario autenticado puede buscar un código para redimirlo"
  on invite_codes for select
  using (true);

create policy "Un usuario administra su propio código"
  on invite_codes for insert
  with check (auth.uid() = user_id);

create policy "Un usuario puede regenerar su propio código"
  on invite_codes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

El `select` sin restricción es necesario porque quien redime un código todavía no está "conectado" con el dueño — no hay otra forma de resolver a quién pertenece sin abrir la lectura. El código en sí no es sensible: solo permite *iniciar* una conexión, nunca leer datos por sí solo.

Tabla nueva `connections` (reemplaza cualquier idea de una tabla específica de "trainer_students" — es simétrica, sin distinguir quién inició):

```sql
create table connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_no_self check (user_a <> user_b),
  unique (user_a, user_b)
);

alter table connections enable row level security;

create policy "Los dos lados de una conexión pueden verla"
  on connections for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Cualquiera puede conectarse a sí mismo con otro usuario"
  on connections for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create policy "Cualquiera de los dos lados puede desvincularse"
  on connections for delete
  using (auth.uid() = user_a or auth.uid() = user_b);
```

Al redimir un código, se inserta la fila con **`user_a`/`user_b` ordenados canónicamente** (los dos UUIDs ordenados alfabéticamente, no "quién generó el código" / "quién lo redimió") — necesario porque `unique(user_a, user_b)` solo bloquea un duplicado exacto en ese orden. Sin canonizar, si A comparte su código con B y **después** B comparte el suyo con A, quedarían dos filas (`user_a: A, user_b: B` y `user_a: B, user_b: A`) representando la misma conexión dos veces. Ordenando siempre los dos ids antes de insertar, cualquiera de los dos que redima el código del otro cae en la misma fila, y el segundo intento simplemente falla por la restricción `unique` (tratado como "ya conectados", no como error).

**Nota sobre el modelo de amenaza de esta política:** el `with check` de `insert` en `connections` (sección 2) solo exige que quien inserta sea una de las dos partes — no verifica criptográficamente que hubo un código real de por medio. En la práctica esto no importa: un `user_id` de Supabase es un UUID de 128 bits, imposible de adivinar; la única forma real de conocer el `user_id` de otra persona es resolviéndolo vía su código de invitación (o ya estando conectado). El código es la capa de descubrimiento/usabilidad, no un candado extra a nivel RLS — mismo modelo ya usado para el `insert` de `routines` en la sección 2.

`routines` gana una columna nueva, sin tocar el resto de su forma:

```sql
alter table routines add column assigned_by_name text;
```

`null` en una rutina creada normalmente por su dueño; el nombre del entrenador (tal cual estaba en `profiles.display_name` al momento de asignar, o `'tu entrenador'` si no tiene nombre cargado) en una rutina asignada. Es una foto histórica, no una referencia — no cambia si el entrenador edita su nombre después ni si se desvinculan.

## 2. Políticas RLS que se agregan (sin tocar las existentes)

**`profiles`** gana una política de lectura nueva — hoy es 100% privado, ni un entrenador puede ver el perfil de nadie:

```sql
create policy "Usuarios conectados pueden verse el perfil básico entre sí"
  on profiles for select
  using (
    exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = profiles.user_id)
         or (connections.user_b = auth.uid() and connections.user_a = profiles.user_id)
    )
  );
```

**`routines`** gana una política de `insert` nueva, que Postgres combina con la ya existente (`auth.uid() = user_id`) vía OR entre políticas permisivas del mismo comando — no hace falta tocar ni borrar la política vieja:

```sql
create policy "Un entrenador conectado puede crear rutinas para la otra persona"
  on routines for insert
  with check (
    exists (
      select 1 from profiles me
      join connections c
        on (c.user_a = auth.uid() and c.user_b = routines.user_id)
        or (c.user_b = auth.uid() and c.user_a = routines.user_id)
      where me.user_id = auth.uid() and me.is_trainer = true
    )
  );
```

La política vieja (`auth.uid() = user_id`) sigue sola gobernando `select`/`update`/`delete` — el entrenador que acaba de insertar una rutina para otra persona **no** gana ningún acceso de lectura/edición sobre ella después. La rutina queda 100% de quien la recibió, exactamente como se pidió.

Ninguna otra tabla (`workouts`, `workout_sets`, `workout_sessions`, `measurements`, `active_routines`) se toca — explícitamente fuera de alcance.

## 3. Flujo de invitación y conexión

**Generar/compartir el código** (cualquier usuario, desde Perfil): `getMyInviteCode()` lee `invite_codes` por `user_id`; si no existe, `createInviteCode()` genera uno con un charset de 32 caracteres sin ambigüedad visual (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — sin `0/O`, `1/I/L`) de 6 caracteres vía `crypto.getRandomValues`, con reintento en el raro caso de colisión (`unique` constraint), y lo inserta. El link a compartir es `${site}${base}c/#${code}` (ej. `https://pamela-ruiz9.github.io/SelfGains/c/#AB3F9K`).

**Redimir el código** — página nueva `src/pages/c.astro`, estática y fija (sin parámetro de ruta), que monta un componente React chico:

```tsx
useEffect(() => {
  const code = window.location.hash.slice(1);
  if (!code) { setStatus('error'); return; }
  redeemInviteCode(code)
    .then(() => { window.location.href = `${import.meta.env.BASE_URL}conexiones/`; })
    .catch((err) => setStatus('error'));
}, []);
```

`redeemInviteCode(code)`: busca `invite_codes` por `code` (mayúscula-insensible, se normaliza a mayúsculas antes de comparar); si no existe, error "Código inválido"; si existe y `owner_id === auth.uid()` (usuario intentando conectarse consigo mismo), error "No podés conectarte con vos mismo"; si ya existe la conexión, no hace nada (no falla, simplemente redirige); si no, `insert` en `connections`.

Si el usuario no está logueado al abrir el link, se muestra un mensaje ("Iniciá sesión y volvé a abrir este link") con un link a `/login/`, sin intentar retomar la redención automáticamente después — el proyecto no tiene hoy ningún mecanismo genérico de "volvé a donde estabas" tras el login (cada formulario de auth redirige a una ruta fija), e inventar uno nuevo solo para este flujo sería más infraestructura de la que amerita: el usuario simplemente vuelve a abrir el link que ya tiene (en el chat/mensaje donde se lo compartieron) una vez logueado.

## 4. Pantallas

**Perfil (`ProfileForm.tsx` o una tarjeta nueva junto a él):**
- Checkbox "Soy entrenador" → `setIsTrainer(true|false)`, actualiza `profiles.is_trainer`.
- Tarjeta "Compartir mi perfil": muestra el link corto (con botón "Copiar"), y un botón "Regenerar" que invalida el anterior (`update` con un código nuevo — cualquiera que tuviera el link viejo ya no puede redimirlo).
- Tarjeta "Conexiones": *"Tenés N conexiones →"* (o *"Compartí tu perfil o conectate con alguien →"* si `N === 0`), link a `/conexiones/`.

**`/conexiones/`** (página nueva, `src/pages/conexiones.astro` + isla React `Connections.tsx`):
- Lista cada conexión: `Avatar` (con distintivo si `is_trainer` de esa persona) + nombre.
- Botón "Desvincular" por conexión (`delete` en `connections`, cualquiera de los dos lados).
- Si el usuario actual es entrenador (`profiles.is_trainer` propio): botón extra "Asignar rutina" por conexión → abre un picker con las rutinas propias del entrenador (reusa `getMyRoutines()`, ya existe) → al elegir una, `assignRoutineToStudent(routineId, connectionUserId)` copia `name`/`days` a una fila nueva con `user_id: connectionUserId`, `assigned_by_name: miNombre ?? 'tu entrenador'`.

**`Avatar` component nuevo** (`src/components/react/Shared/Avatar.tsx`) — no existe hoy un componente compartido para avatares (`Nav.astro` y `ProfileForm.tsx` renderizan el propio inline, sin tocarlos). Recibe `avatarUrl`, `displayName`, `isTrainer`; si `isTrainer`, dibuja un ícono chico (silbato) superpuesto en la esquina inferior-derecha del círculo, en `--color-acid`. Se usa solo en `/conexiones/` — no se toca `Nav.astro` ni `ProfileForm.tsx` en esta ronda (fuera de alcance, ninguno necesita mostrar el avatar de otra persona).

**`RoutineList.tsx`** gana una línea nueva: si `routine.assigned_by_name` no es `null`, muestra `Compartida por: {assigned_by_name}` (`label-brutal` chico) debajo del nombre de la rutina. Sin ningún otro cambio a esa pantalla — la rutina asignada se edita/borra con los mismos botones que cualquier otra.

## Testing

Sin suite automatizada (consistente con el resto del proyecto). Verificación manual vía Playwright contra `astro build && astro preview` con dos cuentas de prueba (la ya reusada + una nueva creada vía `supabase db query --linked` o reactivada de una sesión anterior):

- Generar un código desde la cuenta A, abrir el link `/c/#CODIGO` logueado como cuenta B, confirmar que aparece la conexión en `/conexiones/` de ambos lados.
- Confirmar que sin estar conectados, `select` sobre `profiles`/lectura del nombre del otro falla (RLS), y que conectados, funciona.
- Activar "Soy entrenador" en A, confirmar que aparece "Asignar rutina" en la fila de B dentro de `/conexiones/` de A, y que NO aparece en la fila de A dentro de `/conexiones/` de B (B no es entrenador).
- Asignar una rutina de A a B, confirmar que aparece en "Mis rutinas" de B con la leyenda "Compartida por: [nombre de A]", que B puede editarla y borrarla sin restricción, y que A no tiene ningún acceso a esa fila después de crearla (un `select`/`update` de A sobre esa rutina debe fallar por RLS).
- Regenerar el código de A, confirmar que el link viejo ya no redime nada.
- Desvincularse desde el lado de B, confirmar que desaparece de `/conexiones/` en ambos lados y que el `select` cruzado de `profiles` vuelve a fallar.
