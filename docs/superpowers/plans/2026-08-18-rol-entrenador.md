# Rol de entrenador + conexiones entre usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario puede compartir un link corto de su perfil y conectarse con otro con consentimiento mutuo; si uno de los dos es entrenador (autodeclarado), puede además crearle rutinas directamente al otro, que quedan 100% de quien las recibe.

**Architecture:** Una tabla de conexión genérica y simétrica (`connections`) más un código de invitación corto (`invite_codes`) resuelven el consentimiento una sola vez para dos capacidades: verse el perfil básico (siempre, entre conectados) y crear rutinas para el otro (solo si sos entrenador). Todo por RLS — sin funciones RPC de Postgres, siguiendo el patrón `supabase.from(...)` ya usado en todo el proyecto. Como el sitio es 100% estático (`output: 'static'`, GitHub Pages), el link de invitación usa un fragmento hash sobre una página fija (`/c/#CODIGO`) en vez de una ruta dinámica.

**Tech Stack:** Astro 5 + React (patrón `client:load` ya establecido), Supabase (Postgres + RLS + Auth, ya en el stack), `crypto.getRandomValues` para generar el código corto — sin dependencias nuevas.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-18-rol-entrenador-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — `profiles.is_trainer`, `routines.assigned_by_name`, tablas `invite_codes`/`connections`, políticas RLS nuevas.
- **Modify:** `src/types/db.ts` — `Profile.is_trainer`, `Routine.assigned_by_name`, tipos `InviteCode`/`Connection`.
- **Create:** `src/lib/connections.ts` — códigos de invitación, redención, listado y borrado de conexiones.
- **Modify:** `src/lib/routines.ts` — `assignRoutineToStudent`.
- **Modify:** `src/components/react/Profile/ProfileForm.tsx` — checkbox "Soy entrenador".
- **Create:** `src/components/react/Shared/Avatar.tsx` — avatar reusable con distintivo de entrenador.
- **Create:** `src/pages/c.astro` + `src/components/react/Connections/RedeemInvite.tsx` — página de redención del link corto.
- **Create:** `src/pages/conexiones.astro` + `src/components/react/Connections/Connections.tsx` — pantalla principal: compartir mi perfil, conectarme con un código, lista de conexiones, asignar rutina.
- **Modify:** `src/components/react/RoutineManager/RoutineList.tsx` — leyenda "Compartida por".
- **Modify:** `src/components/react/RoutineManager/RoutineManager.tsx` — pasar `assigned_by_name` a `RoutineList`.
- **Modify:** `src/pages/perfil.astro` — tarjeta "Conexiones" con link a `/conexiones/`.

---

### Task 1: Migración de base de datos + tipos TypeScript

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

```sql

-- Rol de entrenador + conexiones entre usuarios
-- (docs/superpowers/specs/2026-08-18-rol-entrenador-design.md).
alter table profiles add column is_trainer boolean not null default false;
alter table routines add column assigned_by_name text;

create table invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "Cualquier usuario autenticado puede buscar un código para redimirlo"
  on invite_codes for select
  using (true);

create policy "Un usuario crea su propio código"
  on invite_codes for insert
  with check (auth.uid() = user_id);

create policy "Un usuario puede regenerar su propio código"
  on invite_codes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

create policy "Usuarios conectados pueden verse el perfil básico entre sí"
  on profiles for select
  using (
    exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = profiles.user_id)
         or (connections.user_b = auth.uid() and connections.user_a = profiles.user_id)
    )
  );

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

- [ ] **Step 2: Aplicar la migración contra el proyecto real**

```bash
cat > /tmp/selfgains-trainer-migration.sql << 'EOF'
alter table profiles add column is_trainer boolean not null default false;
alter table routines add column assigned_by_name text;

create table invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "Cualquier usuario autenticado puede buscar un código para redimirlo"
  on invite_codes for select
  using (true);

create policy "Un usuario crea su propio código"
  on invite_codes for insert
  with check (auth.uid() = user_id);

create policy "Un usuario puede regenerar su propio código"
  on invite_codes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

create policy "Usuarios conectados pueden verse el perfil básico entre sí"
  on profiles for select
  using (
    exists (
      select 1 from connections
      where (connections.user_a = auth.uid() and connections.user_b = profiles.user_id)
         or (connections.user_b = auth.uid() and connections.user_a = profiles.user_id)
    )
  );

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
EOF
supabase db query --linked --file /tmp/selfgains-trainer-migration.sql
rm /tmp/selfgains-trainer-migration.sql
```
Expected: sin errores.

- [ ] **Step 3: Verificar que las tablas y columnas existen**

```bash
supabase db query --linked "select table_name, column_name from information_schema.columns where (table_name = 'profiles' and column_name = 'is_trainer') or (table_name = 'routines' and column_name = 'assigned_by_name');"
supabase db query --linked "select table_name from information_schema.tables where table_name in ('invite_codes', 'connections');"
```
Expected: dos filas en la primera consulta, dos filas en la segunda.

- [ ] **Step 4: Actualizar `src/types/db.ts`**

Reemplazar:

```ts
export interface Routine {
  id: string;
  user_id: string;
  name: string;
  days: RoutineDays;
  created_at: string;
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
}
```

Reemplazar:

```ts
export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  accent_color: string;
  theme: 'light' | 'dark';
  updated_at: string;
}
```

por:

```ts
export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  accent_color: string;
  theme: 'light' | 'dark';
  is_trainer: boolean;
  updated_at: string;
}

export interface InviteCode {
  user_id: string;
  code: string;
  created_at: string;
}

export interface Connection {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx` (`Measurement[]` vs. índice de string — confirmado en sesiones anteriores como preexistente, no arreglar).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/types/db.ts
git commit -m "feat: add trainer role, invite codes, and connections to the schema"
```

---

### Task 2: `src/lib/connections.ts`

**Files:**
- Create: `src/lib/connections.ts`

- [ ] **Step 1: Crear el archivo**

```ts
import { supabase } from './supabase';
import type { Profile } from '../types/db';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function getMyInviteCode(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.code ?? null;
}

export async function createOrRegenerateInviteCode(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from('invite_codes').upsert({ user_id: user.id, code });
    if (!error) return code;
    if (error.code !== '23505') throw error; // no es una colisión de código único, algo más falló
  }
  throw new Error('No se pudo generar un código único, probá de nuevo.');
}

export async function redeemInviteCode(rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error('Código inválido.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data: invite, error: inviteError } = await supabase
    .from('invite_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) throw new Error('Código inválido.');
  if (invite.user_id === user.id) throw new Error('No podés conectarte con vos mismo.');

  // Orden canónico (alfabético) de los dos ids — no "quién generó el código"
  // — para que la restricción unique(user_a, user_b) detecte una conexión
  // ya existente sin importar quién redimió el código de quién.
  const [userA, userB] = [invite.user_id, user.id].sort();

  const { error } = await supabase.from('connections').insert({ user_a: userA, user_b: userB });

  // Ya conectados: el insert falla por la restricción unique — no es un
  // error real, la conexión ya existe, seguimos igual.
  if (error && error.code !== '23505') throw error;
}

export interface ConnectionSummary {
  connectionId: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isTrainer: boolean;
}

export async function getMyConnections(): Promise<ConnectionSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('connections')
    .select('id, user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_a: string; user_b: string }[];
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.user_a === user.id ? r.user_b : r.user_a));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, is_trainer')
    .in('user_id', otherIds);

  if (profilesError) throw profilesError;
  const profileById = new Map((profiles as Profile[]).map((p) => [p.user_id, p]));

  return rows.map((r) => {
    const otherId = r.user_a === user.id ? r.user_b : r.user_a;
    const profile = profileById.get(otherId);
    return {
      connectionId: r.id,
      userId: otherId,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      isTrainer: profile?.is_trainer ?? false,
    };
  });
}

export async function removeConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.from('connections').delete().eq('id', connectionId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre en `ProgressList.tsx`, nada más — nada importa este archivo todavía).

- [ ] **Step 3: Commit**

```bash
git add src/lib/connections.ts
git commit -m "feat: add invite code and connection management"
```

---

### Task 3: Asignar rutina + toggle "Soy entrenador"

**Files:**
- Modify: `src/lib/routines.ts`
- Modify: `src/components/react/Profile/ProfileForm.tsx`

- [ ] **Step 1: Agregar `assignRoutineToStudent` en `src/lib/routines.ts`**

Al final del archivo, después de `deactivateRoutine`, agregar:

```ts
export async function assignRoutineToStudent(routineId: string, studentUserId: string): Promise<Routine> {
  const source = await getRoutineById(routineId);
  if (!source) throw new Error('No se encontró la rutina a asignar.');

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .maybeSingle();

  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: studentUserId,
      name: source.name,
      days: source.days,
      assigned_by_name: myProfile?.display_name ?? 'tu entrenador',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Routine;
}
```

- [ ] **Step 2: Agregar el toggle "Soy entrenador" en `ProfileForm.tsx`**

Reemplazar:

```tsx
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
```

por:

```tsx
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
```

Reemplazar:

```tsx
      const profile = await getMyProfile();
      if (profile) {
        setTheme(profile.theme);
        setAccentColor(profile.accent_color);
        setMeasurements({
```

por:

```tsx
      const profile = await getMyProfile();
      if (profile) {
        setTheme(profile.theme);
        setAccentColor(profile.accent_color);
        setIsTrainer(profile.is_trainer);
        setMeasurements({
```

Reemplazar:

```tsx
  async function handleAccentChange(next: string) {
    setAccentColor(next);
    applyTheme(theme, next);
    try {
      await upsertProfile({ accent_color: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el color.');
    }
  }
```

por:

```tsx
  async function handleAccentChange(next: string) {
    setAccentColor(next);
    applyTheme(theme, next);
    try {
      await upsertProfile({ accent_color: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el color.');
    }
  }

  async function handleTrainerToggle(next: boolean) {
    setIsTrainer(next);
    try {
      await upsertProfile({ is_trainer: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  }
```

Reemplazar:

```tsx
      {routineExpired && (
        <div className="card-brutal border-acid">
          <p className="font-mono text-sm text-paper">
            Tu rutina activa venció — buen momento para actualizar tus medidas y ver cómo vas.
          </p>
        </div>
      )}
```

por:

```tsx
      {routineExpired && (
        <div className="card-brutal border-acid">
          <p className="font-mono text-sm text-paper">
            Tu rutina activa venció — buen momento para actualizar tus medidas y ver cómo vas.
          </p>
        </div>
      )}

      <label className="flex items-center gap-3 font-mono text-sm text-paper">
        <input
          type="checkbox"
          checked={isTrainer}
          onChange={(e) => handleTrainerToggle(e.target.checked)}
          className="h-5 w-5 accent-acid"
        />
        Soy entrenador
      </label>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (mismo error preexistente de siempre).

- [ ] **Step 4: Commit**

```bash
git add src/lib/routines.ts src/components/react/Profile/ProfileForm.tsx
git commit -m "feat: add routine assignment and the trainer toggle in Perfil"
```

---

### Task 4: Componente `Avatar`

**Files:**
- Create: `src/components/react/Shared/Avatar.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
interface AvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  isTrainer?: boolean;
  size?: number;
}

export default function Avatar({ avatarUrl, displayName, isTrainer = false, size = 56 }: AvatarProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-paper-dim/40 bg-surface">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName ?? 'Avatar'} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-xl text-paper-dim">
            {(displayName ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {isTrainer && (
        <span
          aria-label="Entrenador"
          title="Entrenador"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-acid font-display text-sm text-on-accent"
        >
          ★
        </span>
      )}
    </div>
  );
}
```

`★` es un carácter Unicode simple (no un emoji) elegido a propósito — sin ambigüedad de renderizado entre plataformas.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios (nada importa este componente todavía).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Shared/Avatar.tsx
git commit -m "feat: add a shared Avatar component with a trainer badge"
```

---

### Task 5: Página de redención del link (`/c/`)

**Files:**
- Create: `src/components/react/Connections/RedeemInvite.tsx`
- Create: `src/pages/c.astro`

- [ ] **Step 1: Crear `RedeemInvite.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { redeemInviteCode } from '../../../lib/connections';

type Status = 'checking' | 'needs-login' | 'redeeming' | 'error' | 'done';

export default function RedeemInvite() {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = window.location.hash.slice(1);
    if (!code) {
      setStatus('error');
      setError('Este link no trae un código válido.');
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setStatus('needs-login');
        return;
      }
      setStatus('redeeming');
      try {
        await redeemInviteCode(code);
        setStatus('done');
        window.location.href = `${import.meta.env.BASE_URL}conexiones/`;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'No se pudo procesar la invitación.');
      }
    });
  }, []);

  if (status === 'checking' || status === 'redeeming' || status === 'done') {
    return <p className="font-mono text-sm text-paper-dim">Conectando...</p>;
  }

  if (status === 'needs-login') {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Iniciá sesión y volvé a abrir este link para conectarte.{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          Iniciar sesión
        </a>
      </p>
    );
  }

  return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
}
```

- [ ] **Step 2: Crear `src/pages/c.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import RedeemInvite from '../components/react/Connections/RedeemInvite';
---
<BaseLayout title="Conectar">
  <p class="label-brutal mb-3 text-acid">Invitación</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">CONECTAR</h1>
  <RedeemInvite client:load />
</BaseLayout>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, una página más generada (`dist/c/index.html`). `tsc` limpio salvo el mismo error preexistente de `ProgressList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/Connections/RedeemInvite.tsx src/pages/c.astro
git commit -m "feat: add the invite link redemption page"
```

---

### Task 6: Pantalla `/conexiones/`

**Files:**
- Create: `src/components/react/Connections/Connections.tsx`
- Create: `src/pages/conexiones.astro`

- [ ] **Step 1: Crear `Connections.tsx`**

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

  async function refresh() {
    const [profile, myCode, myConnections, routines] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) await refresh();
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
    await navigator.clipboard.writeText(inviteLink(code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <p className="label-brutal text-acid">Compartir mi perfil</p>
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

- [ ] **Step 2: Crear `src/pages/conexiones.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Connections from '../components/react/Connections/Connections';
---
<BaseLayout title="Conexiones">
  <p class="label-brutal mb-3 text-acid">Perfil compartido</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">CONEXIONES</h1>
  <Connections client:load />
</BaseLayout>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, una página más generada (`dist/conexiones/index.html`). `tsc` limpio salvo el mismo error preexistente de `ProgressList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/Connections/Connections.tsx src/pages/conexiones.astro
git commit -m "feat: add the connections screen (share, redeem, list, assign)"
```

---

### Task 7: Leyenda "Compartida por" + tarjeta "Conexiones" en Perfil

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx`
- Modify: `src/pages/perfil.astro`

- [ ] **Step 1: Agregar `assignedByName` a `RoutineOption` y mostrarlo en `RoutineList.tsx`**

Reemplazar:

```tsx
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
}
```

por:

```tsx
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
}
```

Reemplazar:

```tsx
        <div>
          <p className="font-display text-2xl text-paper">{routine.name}</p>
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
        </div>
```

por:

```tsx
        <div>
          <p className="font-display text-2xl text-paper">{routine.name}</p>
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
          {routine.assignedByName && (
            <p className="font-mono text-xs text-paper-dim">Compartida por: {routine.assignedByName}</p>
          )}
        </div>
```

- [ ] **Step 2: Pasar `assignedByName` desde `RoutineManager.tsx`**

Reemplazar:

```tsx
  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
  }));
```

por:

```tsx
  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
    assignedByName: r.assigned_by_name,
  }));
```

- [ ] **Step 3: Agregar la tarjeta "Conexiones" en `perfil.astro`**

Reemplazar:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ProfileForm from '../components/react/Profile/ProfileForm';
import InstallPrompt from '../components/react/InstallPrompt/InstallPrompt';
---
<BaseLayout title="Perfil">
  <p class="label-brutal mb-3 text-acid">Tu cuenta</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">PERFIL</h1>
  <ProfileForm client:load />
  <div class="mt-6">
    <InstallPrompt client:load variant="card" />
  </div>
</BaseLayout>
```

por:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ProfileForm from '../components/react/Profile/ProfileForm';
import InstallPrompt from '../components/react/InstallPrompt/InstallPrompt';
const base = import.meta.env.BASE_URL;
---
<BaseLayout title="Perfil">
  <p class="label-brutal mb-3 text-acid">Tu cuenta</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">PERFIL</h1>
  <ProfileForm client:load />
  <div class="card-brutal mt-6">
    <a href={`${base}conexiones/`} class="font-mono text-sm text-acid underline underline-offset-4 hover:text-paper">
      Conexiones →
    </a>
  </div>
  <div class="mt-6">
    <InstallPrompt client:load variant="card" />
  </div>
</BaseLayout>
```

(El texto es fijo — "Conexiones →" — en vez de mostrar el conteo dinámico de conexiones: eso requeriría convertir esta tarjeta en una isla React solo para un número, y `/conexiones/` ya lo muestra apenas se entra. Mantenerlo estático es más simple y suficiente.)

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 13 páginas generadas (11 + `/c/` + `/conexiones/` de las tareas 5 y 6). `tsc` limpio salvo el mismo error preexistente de `ProgressList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/RoutineManager/RoutineList.tsx src/components/react/RoutineManager/RoutineManager.tsx src/pages/perfil.astro
git commit -m "feat: show who shared an assigned routine, link to Conexiones from Perfil"
```

---

### Task 8: Verificación manual end-to-end

Sin suite de tests automatizada (consistente con el resto del proyecto). Necesita **dos** cuentas de prueba (la ya reusada en sesiones anteriores, `crud-e2e-1786826288@gmail.com`, más una segunda — reactivar una vieja de una sesión anterior si existe, o crear una nueva vía `supabase db query --linked`, nunca vía Admin API con la service-role key en curl crudo en sesiones de background/auto-mode — ver `docs/agents/notas-de-entorno-y-lecciones.md`).

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 13 páginas. Único error de `tsc` el preexistente de `ProgressList.tsx`.

- [ ] **Step 2: Matar procesos huérfanos, levantar `astro preview`**

```bash
ps aux | grep -E "astro dev|astro preview|esbuild" | grep -v grep
```
Matar cualquier proceso de una corrida anterior con `kill -9 <pid>`.

```bash
npm run build
npx astro preview --port 4331 &
sleep 3
```

- [ ] **Step 3: Antes de conectar, confirmar que la lectura cruzada de perfil falla (RLS)**

Con Playwright, loguear como cuenta A, e intentar leer el perfil de la cuenta B por su `user_id` directamente vía el cliente de Supabase en la consola del navegador — confirmar que devuelve vacío (RLS bloquea, no hay conexión todavía). Obtener el `user_id` de B de antemano vía `supabase db query --linked "select id from auth.users where email = '<email de B>';"`.

- [ ] **Step 4: Generar y redimir un código de invitación**

1. Cuenta A: ir a `/conexiones/`, tocar "Generar mi link", copiar el código mostrado en el link (la parte después de `#`).
2. Cuenta B (otro `BrowserContext` de Playwright, logueada): navegar a `${BASE}/c/#<codigo-de-A>`.
3. Confirmar que redirige a `/conexiones/` de B y que A aparece en la lista.
4. Confirmar que en `/conexiones/` de A también aparece B (la conexión es simétrica).

- [ ] **Step 5: Confirmar que la lectura cruzada de perfil ahora funciona**

Repetir el chequeo del Step 3 (leer el perfil de B desde la sesión de A) — ahora debe devolver los datos básicos (`display_name`, `avatar_url`, `is_trainer`), confirmando que la política RLS nueva de `profiles` funciona.

- [ ] **Step 6: Activar "Soy entrenador" y asignar una rutina**

1. Cuenta A: en Perfil, activar el checkbox "Soy entrenador".
2. Cuenta A: en Rutinas, crear una rutina propia si no tiene ninguna.
3. Cuenta A: volver a `/conexiones/`, confirmar que aparece "Asignar rutina" en la fila de B, elegir la rutina creada.
4. Cuenta B: ir a `/rutinas/`, confirmar que la rutina aparece en "Mis rutinas" con la leyenda "Compartida por: [nombre de A]".
5. Cuenta B: editar esa rutina (cambiar el nombre) y guardar — confirmar que funciona sin error.
6. Cuenta A: intentar leer esa misma rutina (`supabase.from('routines').select('*').eq('id', '<id>')` desde la sesión de A en la consola) — confirmar que devuelve vacío (A no tiene acceso de lectura sobre una rutina que ya es de B).

- [ ] **Step 7: Regenerar el código, confirmar que el viejo ya no sirve**

1. Cuenta A: tocar "Regenerar" en `/conexiones/`, copiar el nuevo código.
2. Con una tercera cuenta (o cerrando sesión y logueando de nuevo como una cuenta sin conexión previa con A), intentar abrir el link con el código VIEJO — confirmar que muestra "Código inválido."

- [ ] **Step 8: Desvincularse**

1. Cuenta B: en `/conexiones/`, tocar "Desvincular" sobre A.
2. Confirmar que desaparece de la lista de B.
3. Cuenta A: confirmar que también desaparece de la lista de A.
4. Repetir el chequeo de lectura cruzada de perfil (Step 3) — debe volver a fallar.

- [ ] **Step 9: Limpieza**

```bash
kill %1
ps aux | grep -E "astro preview|esbuild" | grep -v grep
```
Matar cualquier proceso que haya quedado colgado. Si se creó una cuenta de prueba nueva, dejarla para reuso futuro (patrón ya documentado) salvo que el usuario pida borrarla explícitamente.
