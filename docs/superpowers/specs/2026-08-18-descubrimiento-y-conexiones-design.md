# Descubrimiento y conexiones entre usuarios — diseño

Retoma el brainstorming que quedó explícitamente diferido durante `docs/superpowers/specs/2026-08-18-rol-entrenador-design.md`: "cómo debería conectarse un usuario con otro" en general, más allá del código/link de invitación que ya existe. Junta dos ítems del backlog de negocio (`docs/roadmap-ideas.md`): "buscador de entrenadores cercanos (mapa + geolocalización)" y "compartir rutinas entre usuarios normales". El mecanismo de código/link existente (`invite_codes`) **no se toca** — sigue siendo un atajo válido en paralelo al buscador nuevo.

**Pedido:**
- Cualquier usuario puede buscar a otro por nombre y mandarle una solicitud de conexión, sin depender de compartir un código por fuera de la app.
- Un buscador de entrenadores con mapa: cualquier usuario ve en un mapa a los entrenadores que optaron por ser visibles cerca de una ubicación, con su especialidad, tarifa y una bio corta.
- Dos usuarios ya conectados (sin relación entrenador/alumno) pueden compartirse rutinas entre sí — a diferencia de la asignación de entrenador→alumno (que copia directo, sin preguntar), acá el receptor tiene que confirmar explícitamente antes de que se cree la copia.

**Explícitamente fuera de esta ronda:**
- Chat/mensajería entre usuarios conectados.
- Notificaciones push/email para solicitudes nuevas — se ven solo al entrar a `/conexiones/`, mismo patrón que el resto de la app (banners que solo se ven si el usuario entra a la pantalla).
- Editar o revocar la visibilidad de `trainer_profiles` de otro usuario — cada entrenador administra solo la suya.
- Filtrar/ordenar el buscador de entrenadores por tarifa — la tarifa se muestra, no se usa como filtro.
- "Perfil enriquecido" (sexo, nivel de entrenamiento) — ítem separado del backlog, no se toca.
- Sincronizar una rutina compartida si el original se edita después de aceptada — es una copia congelada al momento de aceptar, igual que la asignación de entrenador.
- Reemplazar o generalizar el mecanismo de código/link existente — sigue existiendo tal cual.

## Enfoque técnico elegido

**Dos tablas de "propuesta pendiente" separadas, no un mecanismo genérico.** `connection_requests` (buscar y pedir conectarse) y `routine_shares` (proponer compartir una rutina) tienen forma de dato distinta — una no referencia nada más, la otra referencia una rutina puntual — y el proyecto ya sigue el patrón de tablas paralelas en vez de una genérica (`workout_sets`/`workout_sessions`). Cada una es una tabla `pending/accepted/rejected` chica, sin abstracción compartida.

**`public_identities` pasa de "solo conectados" a "cualquier usuario autenticado" en lectura.** Es la pieza mínima que ya existía para no exponer `profiles` completo (ver `docs/superpowers/specs/2026-08-18-rol-entrenador-design.md` sección 1) — ampliar quién puede leerla no cambia qué expone (nombre/avatar/si es entrenador), solo quién puede verla antes de estar conectado. Es el cambio que habilita la búsqueda por nombre.

**Mapa sin backend propio.** El sitio es estático (`output: 'static'`) y el proyecto no usa funciones RPC de Postgres — el buscador de entrenadores usa Leaflet + tiles de OpenStreetMap (sin API key) en el cliente, y el filtro por radio se calcula en JS (Haversine) sobre los `trainer_profiles` visibles, sin PostGIS ni `earthdistance` del lado del servidor.

**Compartir rutina = copia, con un paso de confirmación de más que la asignación de entrenador.** El dueño no pierde nada ni nadie puede tocar su rutina original (misma garantía que ya existe para `assigned_by_name`); la diferencia con el flujo de entrenador es que acá el receptor decide *antes* de que exista la copia, vía una fila `routine_shares` que el receptor puede previsualizar (RLS nueva, acotada a esa única rutina) y aceptar o rechazar.

## 1. Modelo de datos

`public_identities` gana lectura abierta a cualquier autenticado — la política vieja queda redundante (la nueva es un superconjunto), se reemplaza:

```sql
drop policy "Usuarios conectados pueden ver la identidad pública del otro" on public_identities;

create policy "Cualquier usuario autenticado puede buscar identidades públicas"
  on public_identities for select
  using (true);
```

Mismo patrón que ya usa `invite_codes` (`"Cualquiera puede buscar un código para redimirlo"`, `using (true)`) — no es una política nueva de forma, es extender una que ya existía en el proyecto a una tabla distinta.

Tabla nueva `connection_requests`:

```sql
create table connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint connection_requests_no_self check (from_user_id <> to_user_id),
  unique (from_user_id, to_user_id)
);

alter table connection_requests enable row level security;

create policy "Los dos lados de una solicitud pueden verla"
  on connection_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Un usuario puede enviar una solicitud"
  on connection_requests for insert
  with check (auth.uid() = from_user_id);

create policy "El receptor puede aceptar o rechazar una solicitud"
  on connection_requests for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

create policy "Cualquiera de los dos lados puede cancelar una solicitud"
  on connection_requests for delete
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
```

`unique(from_user_id, to_user_id)` evita que el mismo usuario mande la misma solicitud dos veces, pero no evita que A le mande una solicitud a B mientras B ya le había mandado una a A (dos filas válidas, direcciones opuestas). No se resuelve a nivel de base de datos — la UI lo evita mostrando "Aceptar" en vez de "Enviar solicitud" cuando ya existe una entrante del otro lado (ver sección 3). Si igualmente se crean las dos, aceptar cualquiera de las dos genera la misma fila en `connections` (el `insert` ya tolera el duplicado vía el manejo de conflicto `23505` que usa `redeemInviteCode`), así que no es un estado roto, solo una solicitud sobrante que se puede rechazar o ignorar.

Tabla nueva `trainer_profiles` — separada de `profiles`/`public_identities` a propósito, mismo principio de aislamiento por privacidad que ya se usó para `public_identities` (RLS es por fila, no por columna; una tabla nueva con solo los campos públicos del buscador evita que una política futura sobre `profiles` termine exponiendo algo sensible sin querer):

```sql
create table trainer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_visible boolean not null default false,
  lat double precision,
  lng double precision,
  disciplines text[] not null default '{}',
  bio text,
  rate_amount numeric,
  rate_currency text,
  rate_period text check (rate_period in ('clase', 'mes', 'hora')),
  updated_at timestamptz not null default now()
);

alter table trainer_profiles enable row level security;

create policy "Un entrenador administra su propio perfil de mapa"
  on trainer_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Cualquiera puede ver perfiles de entrenadores visibles"
  on trainer_profiles for select
  using (is_visible = true);
```

Las dos políticas de `select` se combinan con OR (mismo mecanismo ya usado para el `insert` de `routines` en el spec de rol de entrenador): el dueño siempre ve su propia fila aunque `is_visible = false` (para poder editarla antes de publicarla), cualquiera más solo ve filas con `is_visible = true`.

Tabla nueva `routine_shares`:

```sql
create table routine_shares (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint routine_shares_no_self check (from_user_id <> to_user_id)
);

alter table routine_shares enable row level security;

create policy "Los dos lados de una rutina compartida pueden verla"
  on routine_shares for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "El dueño conectado puede proponer compartir su rutina"
  on routine_shares for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from routines
      where routines.id = routine_id and routines.user_id = auth.uid()
    )
    and exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = to_user_id)
         or (connections.user_b = auth.uid() and connections.user_a = to_user_id)
    )
  );

create policy "El receptor puede aceptar o rechazar la propuesta"
  on routine_shares for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

create policy "Quien propuso puede cancelarla mientras esté pendiente"
  on routine_shares for delete
  using (auth.uid() = from_user_id and status = 'pending');
```

## 2. Política RLS nueva sobre `routines` (sin tocar las existentes)

El receptor necesita poder *leer* la rutina propuesta para previsualizarla antes de aceptar — hoy `routines` solo es legible por su dueño. Política nueva, acotada estrictamente a filas con una propuesta pendiente dirigida a él (no gana acceso a ninguna otra rutina del que comparte):

```sql
create policy "El receptor de una rutina compartida pendiente puede verla"
  on routines for select
  using (
    exists (
      select 1 from routine_shares
      where routine_shares.routine_id = routines.id
        and routine_shares.to_user_id = auth.uid()
        and routine_shares.status = 'pending'
    )
  );
```

Se combina por OR con la política existente (`auth.uid() = user_id`, sigue gobernando sola `insert`/`update`/`delete`). Una vez que la propuesta se acepta o se rechaza (`status` deja de ser `'pending'`), esta política deja de aplicar — el receptor pierde la lectura de la rutina original tan pronto como ya tiene su propia copia (o decidió no aceptarla).

Al aceptar, el cliente copia `name`/`days` a una fila nueva en `routines` con `user_id` propio — mismo patrón que `assignRoutineToStudent`, sin encadenar `.select()` después del `insert` (nada del lado del cliente necesita la fila de vuelta; evita el problema de RLS-sobre-RETURNING documentado en `docs/agents/notas-de-entorno-y-lecciones.md`).

## 3. Flujos

**Buscar y conectar:** input de búsqueda en `/conexiones/` → `supabase.from('public_identities').select('user_id, display_name, avatar_url, is_trainer').ilike('display_name', `%${query}%`).neq('user_id', myId).limit(20)`. Por cada resultado: si ya está en `connections`, "Ya conectado"; si hay una `connection_requests` pendiente que **yo** mandé, "Solicitud enviada"; si hay una pendiente que **ellos** me mandaron, "Aceptar" (salta directo a `updateStatus('accepted')` + insert en `connections`, sin crear una segunda fila); si no hay nada, "Conectar" (`insert` en `connection_requests`).

**Responder solicitudes:** sección nueva en `/conexiones/` con las `connection_requests` entrantes pendientes (`to_user_id = auth.uid()`). Aceptar: `update status='accepted'` + `insert` en `connections` (mismo orden canónico y manejo de conflicto `23505` que `redeemInviteCode`). Rechazar: `update status='rejected'` (la fila queda, no se borra — evita que la misma persona pueda volver a mandar spam de solicitudes gracias al `unique`; se puede sumar un botón "Volver a intentar" más adelante si hace falta, fuera de alcance ahora).

**Buscador de entrenadores:** pantalla nueva (sección en `/conexiones/`) con un mapa Leaflet. Al entrar, pide geolocalización del navegador para centrar el mapa; si se rechaza el permiso, el mapa arranca en una vista por defecto y el usuario lo mueve a mano. Trae todos los `trainer_profiles` con `is_visible = true`, calcula distancia a la ubicación actual del mapa (Haversine) y filtra por el radio elegido (5/10/20/50 km). Cada marcador abre una tarjeta con nombre/avatar (de `public_identities`), disciplinas, bio y tarifa. Botón "Conectar" en la tarjeta usa el mismo flujo de solicitud de arriba.

**Hacerme visible como entrenador:** en Perfil, un entrenador (`is_trainer = true`) ve una tarjeta nueva "Buscador de entrenadores" con: mapa chico para arrastrar su pin, checkbox "Visible en el buscador", selector de disciplinas (reusa `DISCIPLINES` de `ActivityPicker`), bio, y tarifa (monto + moneda + selector de período). Guardar hace upsert en `trainer_profiles`.

**Compartir una rutina:** botón "Compartir" en cada rutina propia dentro de `/rutinas/` (mismo lugar que Editar/Eliminar) → picker de mis conexiones → `insert` en `routine_shares`. En `/conexiones/`, sección nueva "Rutinas compartidas pendientes" (recibidas): cada una muestra el nombre de la rutina y quién la mandó, con un botón "Ver" (lee la rutina vía la política nueva de la sección 2, muestra sus días de solo lectura) y dos acciones, "Agregar a mis rutinas" (copia + `update status='accepted'`) y "Rechazar" (`update status='rejected'`, sin copiar nada).

## 4. Pantallas

Todo se agrega a `/conexiones/` (`Connections.tsx`), que hoy solo tiene "generar/copiar/regenerar mi link" + "conectarme con un código" + lista de conexiones. Gana, en este orden:
1. Buscador por nombre (con las solicitudes entrantes justo abajo, para que sea lo primero que se ve si hay algo pendiente).
2. Buscador de entrenadores con mapa (colapsable, como ya se hizo con "+ Agregar nueva rutina" en `/rutinas/` — pedido explícito previo del usuario de no arrancar la pantalla abrumada de opciones).
3. Rutinas compartidas pendientes.
4. Lista de conexiones existente (sin cambios).

`ProfileForm.tsx` gana la tarjeta de "Buscador de entrenadores" (mapa + visibilidad + disciplinas + bio + tarifa) descrita en la sección 3, visible solo si `is_trainer = true` — mismo patrón condicional que ya usa "Asignar rutina" en `/conexiones/`.

`RoutineList.tsx` gana el botón "Compartir" por rutina propia (no aparece en rutinas recibidas de un entrenador, ni en predefinidas).

Componentes nuevos: `MapPicker.tsx` (mapa Leaflet reusado tanto para elegir el pin del entrenador como para el buscador — arrastrar vs. solo ver, misma base), `RoutinePreview.tsx` (solo-lectura, para "Ver" antes de aceptar una rutina compartida).

## Testing

Sin suite automatizada (consistente con el resto del proyecto). Verificación manual vía Playwright contra `astro build && astro preview` con dos cuentas de prueba:

- Buscar por nombre desde la cuenta A sin estar conectada a B, confirmar que aparece en los resultados (antes de este spec, `public_identities` no era legible sin conexión — confirmar que la política vieja realmente se reemplazó, no que quedó una duplicada).
- Mandar solicitud A→B, confirmar que B la ve en "Solicitudes" y que A ve "Solicitud enviada" en vez de poder mandar otra.
- Aceptar desde B, confirmar que aparece en `/conexiones/` de ambos lados igual que si hubiera sido por código.
- Caso cruzado: A y B se mandan solicitud al mismo tiempo (sin que el otro haya respondido) — aceptar cualquiera de las dos, confirmar que termina en una sola fila de `connections`, sin error.
- Activar "Visible en el buscador" desde una cuenta entrenadora con un pin puesto, confirmar que aparece en el mapa de la cuenta B (sin estar conectadas) con disciplinas/bio/tarifa correctas; desactivar visibilidad, confirmar que desaparece.
- Compartir una rutina propia de A a B (conectados), confirmar que B ve la propuesta con "Ver" mostrando los días reales; rechazar y confirmar que no aparece en "Mis rutinas" de B; repetir aceptando y confirmar que sí aparece como copia editable, que A sigue teniendo su original intacto, y que B ya no puede volver a leer la rutina de A vía la política de previsualización (pasó a `accepted`).
- Confirmar que un `select` directo de B sobre una rutina de A que **no** fue compartida sigue fallando por RLS (la política nueva no se filtró a rutinas sin propuesta).
