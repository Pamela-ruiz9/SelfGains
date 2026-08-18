# Descubrimiento y conexiones entre usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario puede buscar a otro por nombre y mandarle una solicitud de conexión (sin depender de compartir el código/link existente), ver un buscador de entrenadores con mapa y conectarse con los que optaron por ser visibles cerca, y compartir una rutina propia con cualquier conexión — el receptor decide si la agrega antes de que se cree la copia.

**Architecture:** Tres tablas de "propuesta pendiente" independientes (`connection_requests`, `trainer_profiles`, `routine_shares`), cada una con su propio ciclo `pending → accepted/rejected`, siguiendo el patrón de tablas paralelas que ya usa el proyecto en vez de un mecanismo genérico. `public_identities` pasa de "solo conectados" a lectura abierta para cualquier autenticado (habilita la búsqueda). El mapa usa Leaflet + tiles de OpenStreetMap en el cliente, sin backend propio ni funciones RPC de Postgres — la distancia se calcula en JS (Haversine) sobre los `trainer_profiles` visibles. Compartir una rutina es una copia (mismo patrón que la asignación de entrenador→alumno), con la diferencia de que acá el receptor la previsualiza y confirma antes de que exista la copia, vía una política de RLS nueva y acotada sobre `routines`.

**Tech Stack:** Astro 5 + React (patrón `client:load` ya establecido), Supabase (Postgres + RLS + Auth), Leaflet + `@types/leaflet` (dependencia nueva, sin API key) para el mapa.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-18-descubrimiento-y-conexiones-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — política de `public_identities` reemplazada, tablas `connection_requests`/`trainer_profiles`/`routine_shares`, política nueva de `select` sobre `routines`.
- **Modify:** `src/types/db.ts` — tipos `ConnectionRequest`/`TrainerProfile`/`RoutineShare`.
- **Create:** `src/lib/connectionRequests.ts` — búsqueda por nombre, enviar/aceptar/rechazar solicitudes.
- **Create:** `src/lib/trainerProfiles.ts` — perfil de mapa propio, listado de entrenadores visibles cerca (Haversine).
- **Create:** `src/components/react/Shared/MapPicker.tsx` — mapa Leaflet reusable (pin arrastrable / marcadores de solo lectura).
- **Modify:** `src/components/react/Profile/ProfileForm.tsx` — tarjeta "Buscador de entrenadores" (visible solo si `is_trainer`).
- **Create:** `src/lib/routineShares.ts` — proponer/previsualizar/aceptar/rechazar una rutina compartida entre pares.
- **Modify:** `src/components/react/RoutineManager/RoutineList.tsx` — botón "Compartir" por rutina propia.
- **Create:** `src/components/react/RoutineManager/RoutinePreview.tsx` — vista de solo lectura de los días de una rutina.
- **Modify:** `src/components/react/Connections/Connections.tsx` — búsqueda + solicitudes, buscador de entrenadores, rutinas compartidas pendientes (tres pasadas: Task 3, Task 7, Task 10).
- **Modify:** `src/pages/conexiones.astro` — pasa `activities` (igual que `rutinas/index.astro`) para que `RoutinePreview` pueda mostrar nombres de ejercicios.

---

### Task 1: Migración de base de datos + tipos TypeScript

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

```sql

-- Descubrimiento y conexiones entre usuarios
-- (docs/superpowers/specs/2026-08-18-descubrimiento-y-conexiones-design.md).

drop policy "Usuarios conectados pueden ver la identidad pública del otro" on public_identities;

create policy "Cualquier usuario autenticado puede buscar identidades públicas"
  on public_identities for select
  using (true);

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

- [ ] **Step 2: Aplicar la migración contra el proyecto real**

```bash
supabase db query --linked --file <ruta-al-archivo-con-el-sql-de-arriba>
```

Ver `docs/agents/notas-de-entorno-y-lecciones.md` si esto corre en una sesión de background/auto-mode (usar el CLI, nunca `curl` con la service-role key en texto plano).

- [ ] **Step 3: Verificar tablas y políticas contra el proyecto real**

```bash
supabase db query --linked "select tablename, policyname from pg_policies where tablename in ('public_identities', 'connection_requests', 'trainer_profiles', 'routine_shares', 'routines') order by tablename, policyname;"
```

Expected: las políticas nuevas listadas arriba presentes, y la política vieja `"Usuarios conectados pueden ver la identidad pública del otro"` ausente.

- [ ] **Step 4: Agregar los tipos nuevos en `src/types/db.ts`**

Al final del archivo, después de `PublicIdentity`, agregar:

```ts
export interface ConnectionRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface TrainerProfile {
  user_id: string;
  is_visible: boolean;
  lat: number | null;
  lng: number | null;
  disciplines: string[];
  bio: string | null;
  rate_amount: number | null;
  rate_currency: string | null;
  rate_period: 'clase' | 'mes' | 'hora' | null;
  updated_at: string;
}

export interface RoutineShare {
  id: string;
  routine_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx` (no arreglar).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/types/db.ts
git commit -m "feat: add schema for connection requests, trainer map profiles, and routine shares"
```

---

### Task 2: `src/lib/connectionRequests.ts`

**Files:**
- Create: `src/lib/connectionRequests.ts`

- [ ] **Step 1: Crear el archivo**

```ts
import { supabase } from './supabase';
import type { PublicIdentity } from '../types/db';

export interface SearchResult {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
  status: 'connected' | 'request-sent' | 'request-received' | 'none';
  requestId: string | null;
}

export async function searchUsers(query: string): Promise<SearchResult[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const { data: identities, error } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url, is_trainer')
    .ilike('display_name', `%${trimmed}%`)
    .neq('user_id', user.id)
    .limit(20);
  if (error) throw error;
  const rows = (identities ?? []) as PublicIdentity[];
  if (rows.length === 0) return [];

  const { data: connectionRows, error: connError } = await supabase
    .from('connections')
    .select('user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
  if (connError) throw connError;
  const connectedIds = new Set(
    (connectionRows as { user_a: string; user_b: string }[]).map((c) =>
      c.user_a === user.id ? c.user_b : c.user_a
    )
  );

  const { data: requestRows, error: reqError } = await supabase
    .from('connection_requests')
    .select('id, from_user_id, to_user_id')
    .eq('status', 'pending')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
  if (reqError) throw reqError;
  const requests = (requestRows ?? []) as { id: string; from_user_id: string; to_user_id: string }[];

  return rows.map((r): SearchResult => {
    if (connectedIds.has(r.user_id)) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'connected',
        requestId: null,
      };
    }
    const outgoing = requests.find((req) => req.from_user_id === user.id && req.to_user_id === r.user_id);
    if (outgoing) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'request-sent',
        requestId: outgoing.id,
      };
    }
    const incoming = requests.find((req) => req.to_user_id === user.id && req.from_user_id === r.user_id);
    if (incoming) {
      return {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isTrainer: r.is_trainer,
        status: 'request-received',
        requestId: incoming.id,
      };
    }
    return {
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      isTrainer: r.is_trainer,
      status: 'none',
      requestId: null,
    };
  });
}

export interface IncomingRequest {
  requestId: string;
  fromUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
}

export async function getIncomingRequests(): Promise<IncomingRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('connection_requests')
    .select('id, from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; from_user_id: string }[];
  if (rows.length === 0) return [];

  const { data: identities, error: identitiesError } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url, is_trainer')
    .in(
      'user_id',
      rows.map((r) => r.from_user_id)
    );
  if (identitiesError) throw identitiesError;
  const identityById = new Map((identities as PublicIdentity[]).map((p) => [p.user_id, p]));

  return rows.map((r) => {
    const identity = identityById.get(r.from_user_id);
    return {
      requestId: r.id,
      fromUserId: r.from_user_id,
      displayName: identity?.display_name ?? null,
      avatarUrl: identity?.avatar_url ?? null,
      isTrainer: identity?.is_trainer ?? false,
    };
  });
}

export async function sendConnectionRequest(toUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('connection_requests')
    .insert({ from_user_id: user.id, to_user_id: toUserId });

  // Ya existe la misma solicitud: el insert falla por la restricción
  // unique(from_user_id, to_user_id) — no es un error real.
  if (error && error.code !== '23505') throw error;
}

export async function acceptConnectionRequest(requestId: string, fromUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { error: updateError } = await supabase
    .from('connection_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (updateError) throw updateError;

  // Mismo orden canónico y manejo de duplicado que redeemInviteCode en
  // src/lib/connections.ts.
  const [userA, userB] = [fromUserId, user.id].sort();
  const { error: insertError } = await supabase.from('connections').insert({ user_a: userA, user_b: userB });
  if (insertError && insertError.code !== '23505') throw insertError;
}

export async function rejectConnectionRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('connection_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre, nada usa este archivo todavía).

- [ ] **Step 3: Commit**

```bash
git add src/lib/connectionRequests.ts
git commit -m "feat: add name search and connection request management"
```

---

### Task 3: Búsqueda y solicitudes de conexión en `/conexiones/`

**Files:**
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile } from '../../../lib/profile';
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
import {
  acceptConnectionRequest,
  getIncomingRequests,
  rejectConnectionRequest,
  searchUsers,
  sendConnectionRequest,
  type IncomingRequest,
  type SearchResult,
} from '../../../lib/connectionRequests';
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';

function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

function AssignRoutinePicker({
  studentId,
  routines,
  onAssigned,
}: {
  studentId: string;
  routines: Routine[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign(routineId: string) {
    setSaving(true);
    setError(null);
    try {
      await assignRoutineToStudent(routineId, studentId);
      setOpen(false);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la rutina.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-brutal-sm">
        Asignar rutina
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routines.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">No tenés rutinas propias para asignar todavía.</p>
      ) : (
        routines.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={saving}
            onClick={() => handleAssign(r.id)}
            className="btn-brutal-sm text-left"
          >
            {r.name}
          </button>
        ))
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-mono text-xs text-paper-dim hover:text-paper"
      >
        Cancelar
      </button>
    </div>
  );
}

export default function Connections() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [redeemInput, setRedeemInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  async function refresh() {
    const [profile, myCode, myConnections, routines, incoming] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
      getIncomingRequests(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
    setIncomingRequests(incoming);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) {
        try {
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
        }
      }
    });
  }, []);

  async function handleShare() {
    setError(null);
    try {
      const newCode = await createOrRegenerateInviteCode();
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link.');
    }
  }

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await redeemInviteCode(redeemInput);
      setRedeemInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con ese código.');
    }
  }

  async function handleRemove(connectionId: string) {
    if (!confirm('¿Desvincularte de esta persona?')) return;
    try {
      await removeConnection(connectionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular.');
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSearchResults((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, status: 'request-sent' } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    }
  }

  async function handleAcceptFromSearch(userId: string, requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, userId);
      setSearchResults((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'connected' } : r)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleAcceptIncoming(requestId: string, fromUserId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, fromUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tus conexiones.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Mi link de invitación</p>
        {code ? (
          <div className="flex flex-col gap-2">
            <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleCopy} className="btn-brutal-sm">
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button type="button" onClick={handleShare} className="btn-brutal-sm opacity-60">
                Regenerar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleShare} className="btn-brutal-sm self-start">
            Generar mi link
          </button>
        )}
      </div>

      <form onSubmit={handleRedeem} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Conectarme con un código</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="AB3F9K"
            className="input-brutal"
          />
          <button type="submit" className="btn-brutal-sm shrink-0">
            Conectar
          </button>
        </div>
      </form>

      <form onSubmit={handleSearch} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Buscar usuarios</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre"
            className="input-brutal"
          />
          <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((r) => (
              <div key={r.userId} className="card-brutal flex items-center gap-4">
                <Avatar avatarUrl={r.avatarUrl} displayName={r.displayName} isTrainer={r.isTrainer} />
                <p className="flex-1 font-display text-xl text-paper">{r.displayName ?? 'Sin nombre'}</p>
                {r.status === 'connected' && (
                  <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
                )}
                {r.status === 'request-sent' && (
                  <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                )}
                {r.status === 'request-received' && r.requestId && (
                  <button
                    type="button"
                    onClick={() => handleAcceptFromSearch(r.userId, r.requestId!)}
                    className="btn-brutal-sm"
                  >
                    Aceptar
                  </button>
                )}
                {r.status === 'none' && (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(r.userId)}
                    className="btn-brutal-sm"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Solicitudes de conexión</p>
        {incomingRequests.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés solicitudes pendientes.</p>
        ) : (
          incomingRequests.map((req) => (
            <div key={req.requestId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptIncoming(req.requestId, req.fromUserId)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectIncoming(req.requestId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Mis conexiones</p>
        {connections.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">Todavía no tenés ninguna conexión.</p>
        ) : (
          connections.map((c) => (
            <div key={c.connectionId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
              <div className="flex flex-col items-end gap-2">
                {isTrainer && (
                  <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={refresh} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(c.connectionId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Connections/Connections.tsx
git commit -m "feat: add name search and connection requests to the Conexiones screen"
```

---

### Task 4: Instalar Leaflet + `src/lib/trainerProfiles.ts`

**Files:**
- Modify: `package.json`
- Create: `src/lib/trainerProfiles.ts`

- [ ] **Step 1: Instalar dependencias**

```bash
npm install leaflet @types/leaflet
```

- [ ] **Step 2: Crear `src/lib/trainerProfiles.ts`**

```ts
import { supabase } from './supabase';
import type { TrainerProfile } from '../types/db';

// Buenos Aires como centro por defecto del mapa cuando no hay geolocalización
// ni pin propio todavía — razonable dado que la copy de la app es en español
// rioplatense.
export const DEFAULT_MAP_CENTER: [number, number] = [-34.6037, -58.3816];

export async function getMyTrainerProfile(): Promise<TrainerProfile | null> {
  const { data, error } = await supabase.from('trainer_profiles').select('*').maybeSingle();
  if (error) throw error;
  return data as TrainerProfile | null;
}

export async function upsertTrainerProfile(
  changes: Partial<Omit<TrainerProfile, 'user_id' | 'updated_at'>>
): Promise<TrainerProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('trainer_profiles')
    .upsert({ user_id: user.id, ...changes, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data as TrainerProfile;
}

export interface VisibleTrainer extends TrainerProfile {
  displayName: string | null;
  avatarUrl: string | null;
  distanceKm: number;
}

// Fórmula de Haversine — el proyecto no usa funciones RPC de Postgres ni
// PostGIS, así que la distancia se calcula acá una vez que los
// trainer_profiles visibles ya llegaron completos al cliente.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getVisibleTrainersNear(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): Promise<VisibleTrainer[]> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('*')
    .eq('is_visible', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (error) throw error;
  const rows = (data ?? []) as TrainerProfile[];
  if (rows.length === 0) return [];

  const { data: identities, error: identitiesError } = await supabase
    .from('public_identities')
    .select('user_id, display_name, avatar_url')
    .in(
      'user_id',
      rows.map((r) => r.user_id)
    );
  if (identitiesError) throw identitiesError;
  const identityById = new Map(
    (identities as { user_id: string; display_name: string | null; avatar_url: string | null }[]).map(
      (p) => [p.user_id, p]
    )
  );

  return rows
    .map((r) => {
      const identity = identityById.get(r.user_id);
      return {
        ...r,
        displayName: identity?.display_name ?? null,
        avatarUrl: identity?.avatar_url ?? null,
        distanceKm: distanceKm(centerLat, centerLng, r.lat as number, r.lng as number),
      };
    })
    .filter((t) => t.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre, nada usa este archivo todavía).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/trainerProfiles.ts
git commit -m "feat: add Leaflet dependency and the trainer map profile library"
```

---

### Task 5: Componente `MapPicker`

**Files:**
- Create: `src/components/react/Shared/MapPicker.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
import { useEffect, useRef } from 'react';
import type * as LeafletTypes from 'leaflet';

type Leaflet = typeof LeafletTypes;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface MapPickerProps {
  center: [number, number];
  zoom?: number;
  draggableMarker?: [number, number] | null;
  onDraggableMarkerMove?: (lat: number, lng: number) => void;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  onMapMove?: (lat: number, lng: number) => void;
  height?: number;
}

function makePinIcon(L: Leaflet) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#d7ff3f;border:2px solid #0c0c0a;transform:rotate(-45deg);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
  });
}

export default function MapPicker({
  center,
  zoom = 12,
  draggableMarker = null,
  onDraggableMarkerMove,
  markers = [],
  onMarkerClick,
  onMapMove,
  height = 300,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const draggableMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const markerLayerRef = useRef<LeafletTypes.LayerGroup | null>(null);

  // Import dinámico: Leaflet toca `window`/`document` al cargarse, y Astro
  // pre-renderiza este componente en el servidor durante `astro build` antes
  // de hidratarlo (`client:load`) — un `import` estático de 'leaflet' arriba
  // del archivo rompería el build con "window is not defined". El CSS se
  // importa acá adentro por el mismo motivo.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = mod.default;
      leafletRef.current = L;

      const map = L.map(containerRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      if (draggableMarker) {
        const marker = L.marker(draggableMarker, { icon: makePinIcon(L), draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onDraggableMarkerMove?.(pos.lat, pos.lng);
        });
        draggableMarkerRef.current = marker;
      }

      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(L) }).bindTooltip(m.label);
        if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
        marker.addTo(markerLayerRef.current!);
      }

      if (onMapMove) {
        map.on('moveend', () => {
          const c = map.getCenter();
          onMapMove(c.lat, c.lng);
        });
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      draggableMarkerRef.current = null;
      markerLayerRef.current = null;
    };
    // Se monta una sola vez: Leaflet no está pensado para recrear el mapa en
    // cada render — los cambios de props se sincronizan en los efectos de
    // abajo, sobre el mapa ya creado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draggableMarkerRef.current && draggableMarker) {
      draggableMarkerRef.current.setLatLng(draggableMarker);
    }
  }, [draggableMarker]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(L) }).bindTooltip(m.label);
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
      marker.addTo(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    mapRef.current?.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return <div ref={containerRef} style={{ height, width: '100%' }} className="border-2 border-paper-dim/40" />;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio (confirma que el `import` dinámico de Leaflet no rompe el prerender de Astro). `tsc` limpio salvo el error preexistente de siempre. Nada usa este componente todavía.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Shared/MapPicker.tsx
git commit -m "feat: add a reusable Leaflet map picker component"
```

---

### Task 6: Tarjeta "Buscador de entrenadores" en Perfil

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx`

- [ ] **Step 1: Agregar los imports nuevos**

Reemplazar:

```tsx
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
import { logMeasurement } from '../../../lib/measurements';
import { applyTheme, DEFAULT_ACCENT, type ThemeMode } from '../../../lib/theme';
import { getActiveRoutine, weeksElapsed } from '../../../lib/routines';
import type { Profile } from '../../../types/db';
```

por:

```tsx
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
import { logMeasurement } from '../../../lib/measurements';
import { applyTheme, DEFAULT_ACCENT, type ThemeMode } from '../../../lib/theme';
import { getActiveRoutine, weeksElapsed } from '../../../lib/routines';
import { DEFAULT_MAP_CENTER, getMyTrainerProfile, upsertTrainerProfile } from '../../../lib/trainerProfiles';
import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import MapPicker from '../Shared/MapPicker';
import type { Profile } from '../../../types/db';
```

- [ ] **Step 2: Agregar el estado nuevo**

Reemplazar:

```tsx
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
```

por:

```tsx
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);

  const [trainerVisible, setTrainerVisible] = useState(false);
  const [trainerPin, setTrainerPin] = useState<[number, number] | null>(null);
  const [trainerDisciplines, setTrainerDisciplines] = useState<string[]>([]);
  const [trainerBio, setTrainerBio] = useState('');
  const [trainerRateAmount, setTrainerRateAmount] = useState('');
  const [trainerRateCurrency, setTrainerRateCurrency] = useState('ARS');
  const [trainerRatePeriod, setTrainerRatePeriod] = useState<'clase' | 'mes' | 'hora'>('clase');
  const [savingTrainerProfile, setSavingTrainerProfile] = useState(false);
```

- [ ] **Step 3: Cargar el perfil de entrenador si `is_trainer` en el `useEffect` inicial**

Reemplazar:

```tsx
      const profile = await getMyProfile();
      if (profile) {
        setTheme(profile.theme);
        setAccentColor(profile.accent_color);
        setIsTrainer(profile.is_trainer);
        setMeasurements({
```

por:

```tsx
      const profile = await getMyProfile();
      if (profile) {
        setTheme(profile.theme);
        setAccentColor(profile.accent_color);
        setIsTrainer(profile.is_trainer);
        if (profile.is_trainer) {
          const trainerProfile = await getMyTrainerProfile();
          if (trainerProfile) {
            setTrainerVisible(trainerProfile.is_visible);
            if (trainerProfile.lat !== null && trainerProfile.lng !== null) {
              setTrainerPin([trainerProfile.lat, trainerProfile.lng]);
            }
            setTrainerDisciplines(trainerProfile.disciplines);
            setTrainerBio(trainerProfile.bio ?? '');
            setTrainerRateAmount(trainerProfile.rate_amount?.toString() ?? '');
            setTrainerRateCurrency(trainerProfile.rate_currency ?? 'ARS');
            setTrainerRatePeriod(trainerProfile.rate_period ?? 'clase');
          }
        }
        setMeasurements({
```

- [ ] **Step 4: Agregar los handlers nuevos después de `handleTrainerToggle`**

Reemplazar:

```tsx
  async function handleTrainerToggle(next: boolean) {
    setIsTrainer(next);
    try {
      await upsertProfile({ is_trainer: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  }
```

por:

```tsx
  async function handleTrainerToggle(next: boolean) {
    setIsTrainer(next);
    try {
      await upsertProfile({ is_trainer: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  }

  function toggleTrainerDiscipline(id: string) {
    setTrainerDisciplines((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function handleSaveTrainerProfile() {
    setError(null);
    setSavedMessage(null);
    setSavingTrainerProfile(true);
    try {
      const amount = trainerRateAmount === '' ? null : Number(trainerRateAmount);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        throw new Error('La tarifa debe ser un número válido.');
      }
      if (trainerVisible && !trainerPin) {
        throw new Error('Poné tu pin en el mapa antes de activar la visibilidad.');
      }
      await upsertTrainerProfile({
        is_visible: trainerVisible,
        lat: trainerPin?.[0] ?? null,
        lng: trainerPin?.[1] ?? null,
        disciplines: trainerDisciplines,
        bio: trainerBio.trim() || null,
        rate_amount: amount,
        rate_currency: trainerRateCurrency.trim() || null,
        rate_period: trainerRatePeriod,
      });
      setSavedMessage('Buscador de entrenadores guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSavingTrainerProfile(false);
    }
  }
```

- [ ] **Step 5: Agregar la tarjeta en el render, después del checkbox "Soy entrenador"**

Reemplazar:

```tsx
      <label className="flex items-center gap-3 font-mono text-sm text-paper">
        <input
          type="checkbox"
          checked={isTrainer}
          onChange={(e) => handleTrainerToggle(e.target.checked)}
          className="h-5 w-5 accent-acid"
        />
        Soy entrenador
      </label>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
```

por:

```tsx
      <label className="flex items-center gap-3 font-mono text-sm text-paper">
        <input
          type="checkbox"
          checked={isTrainer}
          onChange={(e) => handleTrainerToggle(e.target.checked)}
          className="h-5 w-5 accent-acid"
        />
        Soy entrenador
      </label>

      {isTrainer && (
        <div className="card-brutal flex flex-col gap-4">
          <p className="label-brutal text-acid">Buscador de entrenadores</p>
          <MapPicker
            center={trainerPin ?? DEFAULT_MAP_CENTER}
            draggableMarker={trainerPin ?? DEFAULT_MAP_CENTER}
            onDraggableMarkerMove={(lat, lng) => setTrainerPin([lat, lng])}
            height={220}
          />
          <p className="font-mono text-xs text-paper-dim">Arrastrá el pin hasta tu zona de trabajo.</p>
          <label className="flex items-center gap-3 font-mono text-sm text-paper">
            <input
              type="checkbox"
              checked={trainerVisible}
              onChange={(e) => setTrainerVisible(e.target.checked)}
              className="h-5 w-5 accent-acid"
            />
            Visible en el buscador
          </label>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleTrainerDiscipline(d.id)}
                className={
                  trainerDisciplines.includes(d.id)
                    ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                    : 'btn-brutal-sm'
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="label-brutal">Bio corta</span>
            <textarea
              value={trainerBio}
              onChange={(e) => setTrainerBio(e.target.value)}
              rows={3}
              className="input-brutal"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Monto</span>
              <input
                type="number"
                value={trainerRateAmount}
                onChange={(e) => setTrainerRateAmount(e.target.value)}
                min={0}
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Moneda</span>
              <input
                type="text"
                value={trainerRateCurrency}
                onChange={(e) => setTrainerRateCurrency(e.target.value)}
                placeholder="ARS"
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Período</span>
              <select
                value={trainerRatePeriod}
                onChange={(e) => setTrainerRatePeriod(e.target.value as 'clase' | 'mes' | 'hora')}
                className="input-brutal"
              >
                <option value="clase">Por clase</option>
                <option value="mes">Por mes</option>
                <option value="hora">Por hora</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveTrainerProfile}
            disabled={savingTrainerProfile}
            className="btn-brutal-sm self-start"
          >
            {savingTrainerProfile ? 'Guardando...' : 'Guardar buscador'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre).

- [ ] **Step 7: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "feat: add the trainer map profile card to Perfil"
```

---

### Task 7: Buscador de entrenadores con mapa en `/conexiones/`

**Files:**
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Reemplazar el archivo completo** (parte sobre el resultado de Task 3 — agrega el buscador de entrenadores con mapa)

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile } from '../../../lib/profile';
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
import {
  acceptConnectionRequest,
  getIncomingRequests,
  rejectConnectionRequest,
  searchUsers,
  sendConnectionRequest,
  type IncomingRequest,
  type SearchResult,
} from '../../../lib/connectionRequests';
import {
  DEFAULT_MAP_CENTER,
  getVisibleTrainersNear,
  type VisibleTrainer,
} from '../../../lib/trainerProfiles';
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';

function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

function AssignRoutinePicker({
  studentId,
  routines,
  onAssigned,
}: {
  studentId: string;
  routines: Routine[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign(routineId: string) {
    setSaving(true);
    setError(null);
    try {
      await assignRoutineToStudent(routineId, studentId);
      setOpen(false);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la rutina.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-brutal-sm">
        Asignar rutina
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routines.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">No tenés rutinas propias para asignar todavía.</p>
      ) : (
        routines.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={saving}
            onClick={() => handleAssign(r.id)}
            className="btn-brutal-sm text-left"
          >
            {r.name}
          </button>
        ))
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-mono text-xs text-paper-dim hover:text-paper"
      >
        Cancelar
      </button>
    </div>
  );
}

export default function Connections() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [redeemInput, setRedeemInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [trainerCenter, setTrainerCenter] = useState<[number, number] | null>(null);
  const [trainerRadiusKm, setTrainerRadiusKm] = useState(10);
  const [nearbyTrainers, setNearbyTrainers] = useState<VisibleTrainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  async function refresh() {
    const [profile, myCode, myConnections, routines, incoming] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
      getIncomingRequests(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
    setIncomingRequests(incoming);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) {
        try {
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!showTrainerSearch || trainerCenter) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setTrainerCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setTrainerCenter(DEFAULT_MAP_CENTER)
    );
  }, [showTrainerSearch, trainerCenter]);

  useEffect(() => {
    if (!trainerCenter) return;
    getVisibleTrainersNear(trainerCenter[0], trainerCenter[1], trainerRadiusKm)
      .then(setNearbyTrainers)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.'));
  }, [trainerCenter, trainerRadiusKm]);

  async function handleShare() {
    setError(null);
    try {
      const newCode = await createOrRegenerateInviteCode();
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link.');
    }
  }

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await redeemInviteCode(redeemInput);
      setRedeemInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con ese código.');
    }
  }

  async function handleRemove(connectionId: string) {
    if (!confirm('¿Desvincularte de esta persona?')) return;
    try {
      await removeConnection(connectionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular.');
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSearchResults((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, status: 'request-sent' } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    }
  }

  async function handleAcceptFromSearch(userId: string, requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, userId);
      setSearchResults((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'connected' } : r)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleAcceptIncoming(requestId: string, fromUserId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, fromUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tus conexiones.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Mi link de invitación</p>
        {code ? (
          <div className="flex flex-col gap-2">
            <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleCopy} className="btn-brutal-sm">
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button type="button" onClick={handleShare} className="btn-brutal-sm opacity-60">
                Regenerar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleShare} className="btn-brutal-sm self-start">
            Generar mi link
          </button>
        )}
      </div>

      <form onSubmit={handleRedeem} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Conectarme con un código</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="AB3F9K"
            className="input-brutal"
          />
          <button type="submit" className="btn-brutal-sm shrink-0">
            Conectar
          </button>
        </div>
      </form>

      <form onSubmit={handleSearch} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Buscar usuarios</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre"
            className="input-brutal"
          />
          <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((r) => (
              <div key={r.userId} className="card-brutal flex items-center gap-4">
                <Avatar avatarUrl={r.avatarUrl} displayName={r.displayName} isTrainer={r.isTrainer} />
                <p className="flex-1 font-display text-xl text-paper">{r.displayName ?? 'Sin nombre'}</p>
                {r.status === 'connected' && (
                  <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
                )}
                {r.status === 'request-sent' && (
                  <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                )}
                {r.status === 'request-received' && r.requestId && (
                  <button
                    type="button"
                    onClick={() => handleAcceptFromSearch(r.userId, r.requestId!)}
                    className="btn-brutal-sm"
                  >
                    Aceptar
                  </button>
                )}
                {r.status === 'none' && (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(r.userId)}
                    className="btn-brutal-sm"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Solicitudes de conexión</p>
        {incomingRequests.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés solicitudes pendientes.</p>
        ) : (
          incomingRequests.map((req) => (
            <div key={req.requestId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptIncoming(req.requestId, req.fromUserId)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectIncoming(req.requestId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!showTrainerSearch ? (
        <button type="button" onClick={() => setShowTrainerSearch(true)} className="btn-brutal self-start">
          + Buscar entrenadores cerca
        </button>
      ) : (
        <div className="card-brutal flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">Buscador de entrenadores</p>
            <button
              type="button"
              onClick={() => setShowTrainerSearch(false)}
              className="font-mono text-xs text-paper-dim hover:text-paper"
            >
              Cerrar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-brutal">Radio</span>
            {[5, 10, 20, 50].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setTrainerRadiusKm(km)}
                className={
                  trainerRadiusKm === km ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
                }
              >
                {km} km
              </button>
            ))}
          </div>
          {trainerCenter && (
            <MapPicker
              center={trainerCenter}
              markers={nearbyTrainers.map((t) => ({
                id: t.user_id,
                lat: t.lat!,
                lng: t.lng!,
                label: t.displayName ?? 'Entrenador',
              }))}
              onMarkerClick={setSelectedTrainerId}
              onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
              height={280}
            />
          )}
          {nearbyTrainers.length === 0 ? (
            <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
          ) : (
            nearbyTrainers.map((t) => (
              <div
                key={t.user_id}
                className={
                  selectedTrainerId === t.user_id
                    ? 'card-brutal flex flex-col gap-2 border-acid'
                    : 'card-brutal flex flex-col gap-2'
                }
              >
                <div className="flex items-center gap-3">
                  <Avatar avatarUrl={t.avatarUrl} displayName={t.displayName} isTrainer />
                  <div>
                    <p className="font-display text-lg text-paper">{t.displayName ?? 'Sin nombre'}</p>
                    <p className="font-mono text-xs text-paper-dim">{t.distanceKm.toFixed(1)} km</p>
                  </div>
                </div>
                {t.disciplines.length > 0 && (
                  <p className="font-mono text-xs text-paper-dim">{t.disciplines.join(', ')}</p>
                )}
                {t.bio && <p className="font-mono text-sm text-paper">{t.bio}</p>}
                {t.rate_amount !== null && (
                  <p className="font-mono text-xs text-paper-dim">
                    {t.rate_amount} {t.rate_currency} / {t.rate_period}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleSendRequest(t.user_id)}
                  className="btn-brutal-sm self-start"
                >
                  Conectar
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Mis conexiones</p>
        {connections.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">Todavía no tenés ninguna conexión.</p>
        ) : (
          connections.map((c) => (
            <div key={c.connectionId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
              <div className="flex flex-col items-end gap-2">
                {isTrainer && (
                  <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={refresh} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(c.connectionId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

(Nota de diseño: hacer click en un marcador resalta la tarjeta correspondiente en la lista de abajo con `border-acid` — se optó por esto en vez de un popup flotante sobre el mapa, más simple con `MapPicker` tal como quedó en Task 5 y suficiente para el pedido del spec.)

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Connections/Connections.tsx
git commit -m "feat: add the trainer map search to the Conexiones screen"
```

---

### Task 8: `src/lib/routineShares.ts`

**Files:**
- Create: `src/lib/routineShares.ts`

- [ ] **Step 1: Crear el archivo**

```ts
import { supabase } from './supabase';
import type { Routine } from '../types/db';

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

export interface PendingRoutineShare {
  shareId: string;
  routineId: string;
  routineName: string;
  fromUserId: string;
  fromDisplayName: string | null;
}

export async function getPendingRoutineShares(): Promise<PendingRoutineShare[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('routine_shares')
    .select('id, routine_id, from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; routine_id: string; from_user_id: string }[];
  if (rows.length === 0) return [];

  const [{ data: routines, error: routinesError }, { data: identities, error: identitiesError }] =
    await Promise.all([
      supabase
        .from('routines')
        .select('id, name')
        .in(
          'id',
          rows.map((r) => r.routine_id)
        ),
      supabase
        .from('public_identities')
        .select('user_id, display_name')
        .in(
          'user_id',
          rows.map((r) => r.from_user_id)
        ),
    ]);
  if (routinesError) throw routinesError;
  if (identitiesError) throw identitiesError;

  const routineById = new Map((routines as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const nameById = new Map(
    (identities as { user_id: string; display_name: string | null }[]).map((p) => [p.user_id, p.display_name])
  );

  return rows.map((r) => ({
    shareId: r.id,
    routineId: r.routine_id,
    routineName: routineById.get(r.routine_id) ?? 'Rutina',
    fromUserId: r.from_user_id,
    fromDisplayName: nameById.get(r.from_user_id) ?? null,
  }));
}

export async function getSharedRoutinePreview(routineId: string): Promise<Routine | null> {
  const { data, error } = await supabase.from('routines').select('*').eq('id', routineId).maybeSingle();
  if (error) throw error;
  return data as Routine | null;
}

export async function acceptRoutineShare(shareId: string, routineId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const source = await getSharedRoutinePreview(routineId);
  if (!source) throw new Error('No se encontró la rutina compartida.');

  // Sin .select() después del insert, mismo motivo que
  // assignRoutineToStudent en src/lib/routines.ts: nada del lado del
  // cliente necesita la fila de vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId);
  if (updateError) throw updateError;
}

export async function rejectRoutineShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('routine_shares').update({ status: 'rejected' }).eq('id', shareId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre, nada usa este archivo todavía).

- [ ] **Step 3: Commit**

```bash
git add src/lib/routineShares.ts
git commit -m "feat: add peer routine share proposal/accept/reject library"
```

---

### Task 9: Botón "Compartir" en `RoutineList`

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`

- [ ] **Step 1: Agregar los imports nuevos**

Reemplazar:

```tsx
import { useState } from 'react';
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  weekdayLabel,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
```

por:

```tsx
import { useState } from 'react';
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  weekdayLabel,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import { getMyConnections, type ConnectionSummary } from '../../../lib/connections';
import { proposeRoutineShare } from '../../../lib/routineShares';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
```

- [ ] **Step 2: Agregar `ShareRoutinePicker` antes de `RoutineCard`**

Reemplazar:

```tsx
function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
  onEdit,
  onDelete,
}: {
```

por:

```tsx
function ShareRoutinePicker({ routineId }: { routineId: string }) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<ConnectionSummary[] | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (connections === null) {
      try {
        setConnections(await getMyConnections());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar tus conexiones.');
        setConnections([]);
      }
    }
  }

  async function handleShare(toUserId: string) {
    setSharing(toUserId);
    setError(null);
    try {
      await proposeRoutineShare(routineId, toUserId);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo compartir la rutina.');
    } finally {
      setSharing(null);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-acid hover:text-paper">
        Compartir
      </button>
    );
  }

  if (done) {
    return <p className="font-mono text-xs text-paper-dim">Propuesta enviada.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {connections === null ? (
        <p className="font-mono text-xs text-paper-dim">Cargando...</p>
      ) : connections.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">No tenés conexiones todavía.</p>
      ) : (
        connections.map((c) => (
          <button
            key={c.userId}
            type="button"
            disabled={sharing !== null}
            onClick={() => handleShare(c.userId)}
            className="text-left font-mono text-xs text-paper hover:text-acid"
          >
            {sharing === c.userId ? 'Compartiendo...' : c.displayName ?? 'Sin nombre'}
          </button>
        ))
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-mono text-xs text-paper-dim hover:text-paper"
      >
        Cancelar
      </button>
    </div>
  );
}

function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
  onEdit,
  onDelete,
}: {
```

- [ ] **Step 3: Agregar el botón "Compartir" junto a Editar/Eliminar**

Reemplazar:

```tsx
        {source === 'custom' && (
          <div className="flex shrink-0 gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => onEdit?.(routine.ref)}
              className="text-acid hover:text-paper"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(routine.ref)}
              className="text-blood hover:text-paper"
            >
              Eliminar
            </button>
          </div>
        )}
```

por:

```tsx
        {source === 'custom' && (
          <div className="flex shrink-0 flex-col items-end gap-2 font-mono text-xs">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onEdit?.(routine.ref)}
                className="text-acid hover:text-paper"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(routine.ref)}
                className="text-blood hover:text-paper"
              >
                Eliminar
              </button>
            </div>
            {!routine.assignedByName && <ShareRoutinePicker routineId={routine.ref} />}
          </div>
        )}
```

(`!routine.assignedByName` excluye tanto rutinas predefinidas como rutinas ya asignadas por un entrenador — mismo campo que ya distingue eso en Task 7 del plan `2026-08-18-rol-entrenador.md`. Una copia recibida por compartir entre pares queda sin `assigned_by_name`, así que sí es re-compartible, como pide el spec.)

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre).

- [ ] **Step 5: Commit**

```bash
git add src/components/react/RoutineManager/RoutineList.tsx
git commit -m "feat: add a Compartir button to propose sharing a routine with a connection"
```

---

### Task 10: Rutinas compartidas pendientes en `/conexiones/`

**Files:**
- Create: `src/components/react/RoutineManager/RoutinePreview.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`
- Modify: `src/pages/conexiones.astro`

- [ ] **Step 1: Crear `RoutinePreview.tsx`**

```tsx
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  weekdayLabel,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface RoutinePreviewProps {
  days: RoutineDays;
  activities: ActivityOption[];
}

export default function RoutinePreview({ days, activities }: RoutinePreviewProps) {
  const scheduledDays = WEEKDAYS.filter((day) => days[day].length > 0);

  if (scheduledDays.length === 0) {
    return <p className="font-mono text-xs text-paper-dim">Esta rutina no tiene días cargados.</p>;
  }

  return (
    <div className="flex flex-col gap-2 border-l-2 border-paper-dim/40 pl-3">
      {scheduledDays.map((day) => (
        <div key={day}>
          <p className="label-brutal">{weekdayLabel(day)}</p>
          <ul className="font-mono text-xs text-paper-dim">
            {days[day].map((entry, i) => {
              const id = entryActivityId(entry);
              const activity = activities.find((a) => a.id === id);
              const label = activity ? fullActivityName(activity) : id;
              const summary = activity ? targetSummary(activity.metricType, entryTarget(entry)) : null;
              return <li key={i}>{summary ? `${label} (${summary})` : label}</li>;
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios. Nada usa este componente todavía.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/RoutineManager/RoutinePreview.tsx
git commit -m "feat: add a read-only routine day/exercise preview component"
```

- [ ] **Step 4: Reemplazar `Connections.tsx` completo** (sobre el resultado de Task 7 — agrega rutinas compartidas pendientes y el prop `activities`)

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile } from '../../../lib/profile';
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
import {
  acceptConnectionRequest,
  getIncomingRequests,
  rejectConnectionRequest,
  searchUsers,
  sendConnectionRequest,
  type IncomingRequest,
  type SearchResult,
} from '../../../lib/connectionRequests';
import {
  DEFAULT_MAP_CENTER,
  getVisibleTrainersNear,
  type VisibleTrainer,
} from '../../../lib/trainerProfiles';
import {
  acceptRoutineShare,
  getPendingRoutineShares,
  getSharedRoutinePreview,
  rejectRoutineShare,
  type PendingRoutineShare,
} from '../../../lib/routineShares';
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';
import RoutinePreview from '../RoutineManager/RoutinePreview';

function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

function AssignRoutinePicker({
  studentId,
  routines,
  onAssigned,
}: {
  studentId: string;
  routines: Routine[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign(routineId: string) {
    setSaving(true);
    setError(null);
    try {
      await assignRoutineToStudent(routineId, studentId);
      setOpen(false);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la rutina.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-brutal-sm">
        Asignar rutina
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routines.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">No tenés rutinas propias para asignar todavía.</p>
      ) : (
        routines.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={saving}
            onClick={() => handleAssign(r.id)}
            className="btn-brutal-sm text-left"
          >
            {r.name}
          </button>
        ))
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="font-mono text-xs text-paper-dim hover:text-paper"
      >
        Cancelar
      </button>
    </div>
  );
}

interface Props {
  activities: ActivityOption[];
}

export default function Connections({ activities }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [redeemInput, setRedeemInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [trainerCenter, setTrainerCenter] = useState<[number, number] | null>(null);
  const [trainerRadiusKm, setTrainerRadiusKm] = useState(10);
  const [nearbyTrainers, setNearbyTrainers] = useState<VisibleTrainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  const [pendingShares, setPendingShares] = useState<PendingRoutineShare[]>([]);
  const [previewShareId, setPreviewShareId] = useState<string | null>(null);
  const [previewDays, setPreviewDays] = useState<RoutineDays | null>(null);
  const [shareActionError, setShareActionError] = useState<string | null>(null);

  async function refresh() {
    const [profile, myCode, myConnections, routines, incoming, shares] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
      getIncomingRequests(),
      getPendingRoutineShares(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
    setIncomingRequests(incoming);
    setPendingShares(shares);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) {
        try {
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!showTrainerSearch || trainerCenter) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setTrainerCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setTrainerCenter(DEFAULT_MAP_CENTER)
    );
  }, [showTrainerSearch, trainerCenter]);

  useEffect(() => {
    if (!trainerCenter) return;
    getVisibleTrainersNear(trainerCenter[0], trainerCenter[1], trainerRadiusKm)
      .then(setNearbyTrainers)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.'));
  }, [trainerCenter, trainerRadiusKm]);

  async function handleShare() {
    setError(null);
    try {
      const newCode = await createOrRegenerateInviteCode();
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link.');
    }
  }

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await redeemInviteCode(redeemInput);
      setRedeemInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con ese código.');
    }
  }

  async function handleRemove(connectionId: string) {
    if (!confirm('¿Desvincularte de esta persona?')) return;
    try {
      await removeConnection(connectionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular.');
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSearchResults((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, status: 'request-sent' } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    }
  }

  async function handleAcceptFromSearch(userId: string, requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, userId);
      setSearchResults((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'connected' } : r)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleAcceptIncoming(requestId: string, fromUserId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId, fromUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  async function handlePreviewShare(share: PendingRoutineShare) {
    setShareActionError(null);
    try {
      const routine = await getSharedRoutinePreview(share.routineId);
      setPreviewDays(routine?.days ?? null);
      setPreviewShareId(share.shareId);
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo cargar la rutina.');
    }
  }

  async function handleAcceptShare(share: PendingRoutineShare) {
    setShareActionError(null);
    try {
      await acceptRoutineShare(share.shareId, share.routineId);
      setPreviewShareId(null);
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo agregar la rutina.');
    }
  }

  async function handleRejectShare(shareId: string) {
    setShareActionError(null);
    try {
      await rejectRoutineShare(shareId);
      setPreviewShareId(null);
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo rechazar.');
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tus conexiones.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Mi link de invitación</p>
        {code ? (
          <div className="flex flex-col gap-2">
            <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleCopy} className="btn-brutal-sm">
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button type="button" onClick={handleShare} className="btn-brutal-sm opacity-60">
                Regenerar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleShare} className="btn-brutal-sm self-start">
            Generar mi link
          </button>
        )}
      </div>

      <form onSubmit={handleRedeem} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Conectarme con un código</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="AB3F9K"
            className="input-brutal"
          />
          <button type="submit" className="btn-brutal-sm shrink-0">
            Conectar
          </button>
        </div>
      </form>

      <form onSubmit={handleSearch} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Buscar usuarios</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre"
            className="input-brutal"
          />
          <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((r) => (
              <div key={r.userId} className="card-brutal flex items-center gap-4">
                <Avatar avatarUrl={r.avatarUrl} displayName={r.displayName} isTrainer={r.isTrainer} />
                <p className="flex-1 font-display text-xl text-paper">{r.displayName ?? 'Sin nombre'}</p>
                {r.status === 'connected' && (
                  <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
                )}
                {r.status === 'request-sent' && (
                  <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                )}
                {r.status === 'request-received' && r.requestId && (
                  <button
                    type="button"
                    onClick={() => handleAcceptFromSearch(r.userId, r.requestId!)}
                    className="btn-brutal-sm"
                  >
                    Aceptar
                  </button>
                )}
                {r.status === 'none' && (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(r.userId)}
                    className="btn-brutal-sm"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Solicitudes de conexión</p>
        {incomingRequests.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés solicitudes pendientes.</p>
        ) : (
          incomingRequests.map((req) => (
            <div key={req.requestId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptIncoming(req.requestId, req.fromUserId)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectIncoming(req.requestId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!showTrainerSearch ? (
        <button type="button" onClick={() => setShowTrainerSearch(true)} className="btn-brutal self-start">
          + Buscar entrenadores cerca
        </button>
      ) : (
        <div className="card-brutal flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">Buscador de entrenadores</p>
            <button
              type="button"
              onClick={() => setShowTrainerSearch(false)}
              className="font-mono text-xs text-paper-dim hover:text-paper"
            >
              Cerrar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-brutal">Radio</span>
            {[5, 10, 20, 50].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setTrainerRadiusKm(km)}
                className={
                  trainerRadiusKm === km ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
                }
              >
                {km} km
              </button>
            ))}
          </div>
          {trainerCenter && (
            <MapPicker
              center={trainerCenter}
              markers={nearbyTrainers.map((t) => ({
                id: t.user_id,
                lat: t.lat!,
                lng: t.lng!,
                label: t.displayName ?? 'Entrenador',
              }))}
              onMarkerClick={setSelectedTrainerId}
              onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
              height={280}
            />
          )}
          {nearbyTrainers.length === 0 ? (
            <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
          ) : (
            nearbyTrainers.map((t) => (
              <div
                key={t.user_id}
                className={
                  selectedTrainerId === t.user_id
                    ? 'card-brutal flex flex-col gap-2 border-acid'
                    : 'card-brutal flex flex-col gap-2'
                }
              >
                <div className="flex items-center gap-3">
                  <Avatar avatarUrl={t.avatarUrl} displayName={t.displayName} isTrainer />
                  <div>
                    <p className="font-display text-lg text-paper">{t.displayName ?? 'Sin nombre'}</p>
                    <p className="font-mono text-xs text-paper-dim">{t.distanceKm.toFixed(1)} km</p>
                  </div>
                </div>
                {t.disciplines.length > 0 && (
                  <p className="font-mono text-xs text-paper-dim">{t.disciplines.join(', ')}</p>
                )}
                {t.bio && <p className="font-mono text-sm text-paper">{t.bio}</p>}
                {t.rate_amount !== null && (
                  <p className="font-mono text-xs text-paper-dim">
                    {t.rate_amount} {t.rate_currency} / {t.rate_period}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleSendRequest(t.user_id)}
                  className="btn-brutal-sm self-start"
                >
                  Conectar
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Rutinas compartidas pendientes</p>
        {shareActionError && <p className="font-mono text-xs text-blood">{shareActionError}</p>}
        {pendingShares.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés propuestas de rutina pendientes.</p>
        ) : (
          pendingShares.map((share) => (
            <div key={share.shareId} className="card-brutal flex flex-col gap-3">
              <p className="font-mono text-sm text-paper">
                <span className="text-acid">{share.fromDisplayName ?? 'Alguien'}</span> te propuso "
                {share.routineName}"
              </p>
              {previewShareId === share.shareId && previewDays && (
                <RoutinePreview days={previewDays} activities={activities} />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => handlePreviewShare(share)} className="btn-brutal-sm">
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptShare(share)}
                  className="btn-brutal-sm border-acid bg-acid text-on-accent"
                >
                  Agregar a mis rutinas
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectShare(share.shareId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Mis conexiones</p>
        {connections.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">Todavía no tenés ninguna conexión.</p>
        ) : (
          connections.map((c) => (
            <div key={c.connectionId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
              <div className="flex flex-col items-end gap-2">
                {isTrainer && (
                  <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={refresh} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(c.connectionId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Actualizar `conexiones.astro` para pasar `activities`**

Reemplazar el archivo completo:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Connections from '../components/react/Connections/Connections';
import { getCollection } from 'astro:content';

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
    group: e.data.metricType === 'session' ? e.data.group : undefined,
    description: e.body?.trim() ?? '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Conexiones">
  <p class="label-brutal mb-3 text-acid">Perfil compartido</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">CONEXIONES</h1>
  <Connections client:load activities={activities} />
</BaseLayout>
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, misma cantidad de páginas que antes (`/conexiones/` ya existía). `tsc` limpio salvo el error preexistente de siempre.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/Connections/Connections.tsx src/pages/conexiones.astro
git commit -m "feat: add pending routine share proposals to the Conexiones screen"
```

---

### Task 11: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

Sin suite de tests automatizada (consistente con el resto del proyecto). Necesita **dos** cuentas de prueba — reusar las ya existentes de sesiones anteriores (`crud-e2e-1786826288@gmail.com` y la reactivada para el spec de rol de entrenador) en vez de crear nuevas, ver `docs/agents/notas-de-entorno-y-lecciones.md`.

- [ ] **Step 1: Build limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. Único error de `tsc` el preexistente de `ProgressList.tsx`.

- [ ] **Step 2: Matar procesos huérfanos, levantar `astro preview`**

```bash
ps aux | grep -E "astro dev|astro preview|esbuild" | grep -v grep
```

Matar cualquier proceso de una corrida anterior con `kill -9 <pid>`. `astro dev` no sirve para esto (Vite rompe la hidratación de islands en pruebas offline/con service worker en corridas previas, y en general el proyecto verifica siempre contra `preview`):

```bash
npm run build
npx astro preview --port 4331 &
sleep 3
```

- [ ] **Step 3: Descubrimiento por nombre**

Con Playwright, dos `BrowserContext` (cuenta A y cuenta B, ninguna conectada entre sí todavía):

1. Cuenta A: en `/conexiones/`, buscar el nombre de B en "Buscar usuarios". Confirmar que aparece en los resultados (antes de este plan, `public_identities` no era legible sin conexión — esto confirma que la política vieja realmente se reemplazó).
2. Cuenta A: tocar "Conectar" sobre el resultado de B. Confirmar que el botón pasa a mostrar "Solicitud enviada".
3. Cuenta B: en `/conexiones/`, confirmar que B aparece en "Solicitudes de conexión" con el nombre de A.
4. Cuenta B: tocar "Aceptar". Confirmar que A aparece en "Mis conexiones" de B.
5. Cuenta A: recargar `/conexiones/`, confirmar que B aparece en "Mis conexiones" de A también (simétrico).

- [ ] **Step 4: Caso cruzado — solicitudes simultáneas**

1. Desvincularse (botón "Desvincular" en cualquiera de las dos cuentas) para volver al estado sin conexión.
2. Cuenta A busca a B y toca "Conectar". Cuenta B busca a A y toca "Conectar" (sin haber visto todavía la solicitud de A).
3. Cuenta B: en "Solicitudes de conexión", aceptar la de A.
4. Confirmar que terminan conectados sin error, y que no hay dos filas en `connections` para el mismo par:

```bash
supabase db query --linked "select count(*) from connections where (user_a, user_b) = (least('<id-A>', '<id-B>'), greatest('<id-A>', '<id-B>'));"
```

Expected: `1`.

- [ ] **Step 5: Buscador de entrenadores**

1. Cuenta A: en Perfil, activar "Soy entrenador" si no lo estaba. Confirmar que aparece la tarjeta "Buscador de entrenadores" con el mapa.
2. Cuenta A: arrastrar el pin a una ubicación, elegir al menos una disciplina, escribir una bio y una tarifa, activar "Visible en el buscador", tocar "Guardar buscador".
3. Cuenta B (sin estar conectada con A todavía — desvincular si hace falta): en `/conexiones/`, tocar "+ Buscar entrenadores cerca". Aceptar o rechazar el permiso de geolocalización del navegador (probar ambos casos: con permiso, el mapa centra en la ubicación real; sin permiso, cae al centro por defecto).
4. Confirmar que A aparece en la lista de entrenadores cercanos (puede requerir centrar el mapa cerca del pin puesto en el Step 2, dado el radio elegido) con disciplina/bio/tarifa correctas.
5. Cuenta A: desactivar "Visible en el buscador", guardar. Cuenta B: refrescar la búsqueda, confirmar que A ya no aparece.

- [ ] **Step 6: Compartir una rutina entre pares**

1. Reconectar A y B (código o búsqueda).
2. Cuenta A: en `/rutinas/`, crear una rutina propia si no tiene ninguna. Tocar "Compartir" sobre esa rutina, elegir a B.
3. Cuenta B: en `/conexiones/`, confirmar que aparece en "Rutinas compartidas pendientes" con el nombre de A y de la rutina.
4. Cuenta B: tocar "Ver", confirmar que se muestra la lista real de días/ejercicios de la rutina de A.
5. Cuenta B: tocar "Rechazar". Confirmar que desaparece de pendientes y que NO aparece en "Mis rutinas" de B.
6. Repetir Steps 2-4, esta vez tocando "Agregar a mis rutinas". Confirmar que aparece en "Mis rutinas" de B, editable (probar cambiar el nombre y guardar), y que la rutina original de A sigue intacta (mismo nombre, sin cambios).
7. Confirmar que B ya no puede volver a leer la rutina de A directamente (la política de previsualización solo aplica a propuestas `pending`):

```bash
# Con el JWT real de B (no supabase db query --linked, que corre con rol
# privilegiado y no reproduce RLS) — confirmar 403/vacío.
```

- [ ] **Step 7: Limpieza**

```bash
kill %1
ps aux | grep -E "astro preview|esbuild" | grep -v grep
```

Matar cualquier proceso que haya quedado colgado. Dejar las cuentas de prueba reactivadas para reuso futuro (patrón ya documentado); si se activó "Soy entrenador"/visibilidad en el mapa solo para esta prueba, desactivarlo al final para no dejar datos de prueba visibles en el buscador real.

---
