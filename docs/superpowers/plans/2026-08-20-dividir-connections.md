# Dividir Connections.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Connections.tsx` (~690 líneas, seis secciones de UI en un solo archivo) queda dividido en 7 componentes de presentación pura, sin cambiar ningún comportamiento, copy, estilo o flujo de datos.

**Architecture:** Cada sección de la UI pasa a un componente nuevo que solo recibe props (datos + callbacks) — cero fetch propio. `Connections.tsx` sigue siendo dueño de todo el estado, `refresh()`, y los `useEffect` existentes; solo cambia qué JSX renderiza. Se hace una sección a la vez: extraer, integrar en `Connections.tsx`, verificar build, commitear — nunca se dejan los 7 componentes creados sin usar ni `Connections.tsx` a medio romper entre tasks.

**Nota sobre el estilo de este plan:** el proyecto no tiene suite de tests automatizada — la verificación es build + `tsc --noEmit` en cada task, más una verificación manual con Playwright al final ejercitando los 6 flujos de la pantalla, mismo patrón que todos los planes previos de este repo.

**Tech Stack:** Astro 5 + React (`client:load`) — sin dependencias nuevas, sin cambios de schema ni de Supabase.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-20-dividir-connections-design.md`.

---

## File Structure

- **Create:** `src/components/react/Connections/InviteLinkCard.tsx`
- **Create:** `src/components/react/Connections/RedeemCodeForm.tsx`
- **Create:** `src/components/react/Connections/UserSearch.tsx`
- **Create:** `src/components/react/Connections/IncomingRequests.tsx`
- **Create:** `src/components/react/Connections/TrainerSearch.tsx`
- **Create:** `src/components/react/Connections/PendingRoutineShares.tsx`
- **Create:** `src/components/react/Connections/MyConnectionsList.tsx`
- **Modify:** `src/lib/connections.ts` — agrega `inviteLink()` (movido desde `Connections.tsx`, para no duplicarlo entre el padre y `InviteLinkCard.tsx`).
- **Modify:** `src/components/react/Connections/Connections.tsx` — en cada task se recorta una sección de JSX y se agregan/sacan imports, nunca se reescribe el archivo completo.

---

### Task 1: `InviteLinkCard` + mover `inviteLink()` a `src/lib/connections.ts`

**Files:**
- Create: `src/components/react/Connections/InviteLinkCard.tsx`
- Modify: `src/lib/connections.ts`
- Modify: `src/components/react/Connections/Connections.tsx`

**Contexto:** `inviteLink(code)` hoy es una función standalone al principio de `Connections.tsx`, usada tanto en el render de esta sección como en `handleCopy()` (que sigue viviendo en `Connections.tsx`, no se mueve). Para no duplicarla, se mueve a `src/lib/connections.ts` (ya tiene el resto de la lógica de invite codes) y ambos archivos la importan de ahí.

- [ ] **Step 1: Mover `inviteLink` a `src/lib/connections.ts`**

Reemplazar:

```ts
import { supabase } from './supabase';
import type { PublicIdentity } from '../types/db';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
```

por:

```ts
import { supabase } from './supabase';
import type { PublicIdentity } from '../types/db';

export function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
```

- [ ] **Step 2: Crear `src/components/react/Connections/InviteLinkCard.tsx`**

```tsx
import { inviteLink } from '../../../lib/connections';

interface Props {
  code: string | null;
  copied: boolean;
  onShare: () => void;
  onCopy: () => void;
}

export default function InviteLinkCard({ code, copied, onShare, onCopy }: Props) {
  return (
    <div className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">Mi link de invitación</p>
      {code ? (
        <div className="flex flex-col gap-2">
          <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCopy} className="btn-brutal-sm">
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
            <button type="button" onClick={onShare} className="btn-brutal-sm opacity-60">
              Regenerar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onShare} className="btn-brutal-sm self-start">
          Generar mi link
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: En `Connections.tsx`, importar `inviteLink` del lib en vez de definirla localmente**

Reemplazar:

```ts
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
```

por:

```ts
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  inviteLink,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
```

- [ ] **Step 4: Quitar la función local `inviteLink` y agregar el import del componente nuevo**

Reemplazar:

```ts
import RoutinePreview from '../RoutineManager/RoutinePreview';

function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

function AssignRoutinePicker({
```

por:

```ts
import RoutinePreview from '../RoutineManager/RoutinePreview';
import InviteLinkCard from './InviteLinkCard';

function AssignRoutinePicker({
```

(`handleCopy()` sigue llamando a `inviteLink(code)` sin cambios — ahora resuelve al import del lib en vez de a la función local que se acaba de borrar.)

- [ ] **Step 5: Usar el componente en el JSX**

Reemplazar:

```tsx
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
```

por:

```tsx
      <InviteLinkCard code={code} copied={copied} onShare={handleShare} onCopy={handleCopy} />
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/connections.ts src/components/react/Connections/InviteLinkCard.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract InviteLinkCard from Connections.tsx"
```

---

### Task 2: `RedeemCodeForm`

**Files:**
- Create: `src/components/react/Connections/RedeemCodeForm.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Crear `src/components/react/Connections/RedeemCodeForm.tsx`**

```tsx
import type { FormEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function RedeemCodeForm({ value, onChange, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">Conectarme con un código</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="AB3F9K"
          className="input-brutal"
        />
        <button type="submit" className="btn-brutal-sm shrink-0">
          Conectar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Agregar el import en `Connections.tsx`**

Reemplazar:

```ts
import InviteLinkCard from './InviteLinkCard';
```

por:

```ts
import InviteLinkCard from './InviteLinkCard';
import RedeemCodeForm from './RedeemCodeForm';
```

- [ ] **Step 3: Usar el componente en el JSX**

Reemplazar:

```tsx
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
```

por:

```tsx
      <RedeemCodeForm value={redeemInput} onChange={setRedeemInput} onSubmit={handleRedeem} />
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/Connections/RedeemCodeForm.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract RedeemCodeForm from Connections.tsx"
```

---

### Task 3: `UserSearch`

**Files:**
- Create: `src/components/react/Connections/UserSearch.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Crear `src/components/react/Connections/UserSearch.tsx`**

```tsx
import type { FormEvent } from 'react';
import type { SearchResult } from '../../../lib/connectionRequests';
import Avatar from '../Shared/Avatar';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  results: SearchResult[];
  searching: boolean;
  hasSearched: boolean;
  onSendRequest: (userId: string) => void;
  onAcceptFromSearch: (userId: string, requestId: string) => void;
}

export default function UserSearch({
  query,
  onQueryChange,
  onSubmit,
  results,
  searching,
  hasSearched,
  onSendRequest,
  onAcceptFromSearch,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">Buscar usuarios</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Nombre"
          className="input-brutal"
        />
        <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {hasSearched && results.length === 0 && (
        <p className="font-mono text-sm text-paper-dim">No se encontraron usuarios.</p>
      )}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
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
                  onClick={() => onAcceptFromSearch(r.userId, r.requestId!)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
              )}
              {r.status === 'none' && (
                <button type="button" onClick={() => onSendRequest(r.userId)} className="btn-brutal-sm">
                  Conectar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Agregar el import en `Connections.tsx`**

Reemplazar:

```ts
import RedeemCodeForm from './RedeemCodeForm';
```

por:

```ts
import RedeemCodeForm from './RedeemCodeForm';
import UserSearch from './UserSearch';
```

- [ ] **Step 3: Usar el componente en el JSX**

Reemplazar:

```tsx
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
        {hasSearched && searchResults.length === 0 && (
          <p className="font-mono text-sm text-paper-dim">No se encontraron usuarios.</p>
        )}
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
```

por:

```tsx
      <UserSearch
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSubmit={handleSearch}
        results={searchResults}
        searching={searching}
        hasSearched={hasSearched}
        onSendRequest={handleSendRequest}
        onAcceptFromSearch={handleAcceptFromSearch}
      />
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/Connections/UserSearch.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract UserSearch from Connections.tsx"
```

---

### Task 4: `IncomingRequests`

**Files:**
- Create: `src/components/react/Connections/IncomingRequests.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Crear `src/components/react/Connections/IncomingRequests.tsx`**

```tsx
import type { IncomingRequest } from '../../../lib/connectionRequests';
import Avatar from '../Shared/Avatar';

interface Props {
  requests: IncomingRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export default function IncomingRequests({ requests, onAccept, onReject }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Solicitudes de conexión</p>
      {requests.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">No tienes solicitudes pendientes.</p>
      ) : (
        requests.map((req) => (
          <div key={req.requestId} className="card-brutal flex items-center gap-4">
            <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
            <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onAccept(req.requestId)} className="btn-brutal-sm">
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => onReject(req.requestId)}
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar el import en `Connections.tsx`**

Reemplazar:

```ts
import UserSearch from './UserSearch';
```

por:

```ts
import UserSearch from './UserSearch';
import IncomingRequests from './IncomingRequests';
```

- [ ] **Step 3: Usar el componente en el JSX**

Reemplazar:

```tsx
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Solicitudes de conexión</p>
        {incomingRequests.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tienes solicitudes pendientes.</p>
        ) : (
          incomingRequests.map((req) => (
            <div key={req.requestId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptIncoming(req.requestId)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectIncoming(req.requestId)}
                  className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
```

por:

```tsx
      <IncomingRequests
        requests={incomingRequests}
        onAccept={handleAcceptIncoming}
        onReject={handleRejectIncoming}
      />
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/Connections/IncomingRequests.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract IncomingRequests from Connections.tsx"
```

---

### Task 5: `TrainerSearch`

**Files:**
- Create: `src/components/react/Connections/TrainerSearch.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

**Contexto:** el `useMemo` de `trainerMarkers` solo lo usa esta sección — se mueve adentro del componente nuevo, calculado a partir del prop `trainers` en vez de leer `nearbyTrainers` directamente. Esto es el único lugar del archivo que usa `useMemo`, así que también se saca ese import de `Connections.tsx`.

- [ ] **Step 1: Crear `src/components/react/Connections/TrainerSearch.tsx`**

```tsx
import { useMemo } from 'react';
import type { VisibleTrainer } from '../../../lib/trainerProfiles';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';

interface Props {
  open: boolean;
  onToggle: (open: boolean) => void;
  center: [number, number] | null;
  onMapMove: (lat: number, lng: number) => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  trainers: VisibleTrainer[];
  selectedTrainerId: string | null;
  onMarkerClick: (id: string) => void;
  sentRequests: Set<string>;
  onConnect: (userId: string) => void;
  onAcceptRequest: (requestId: string) => void;
}

export default function TrainerSearch({
  open,
  onToggle,
  center,
  onMapMove,
  radiusKm,
  onRadiusChange,
  trainers,
  selectedTrainerId,
  onMarkerClick,
  sentRequests,
  onConnect,
  onAcceptRequest,
}: Props) {
  const trainerMarkers = useMemo(
    () =>
      trainers.map((t) => ({
        id: t.user_id,
        lat: t.lat!,
        lng: t.lng!,
        label: t.displayName ?? 'Entrenador',
      })),
    [trainers]
  );

  if (!open) {
    return (
      <button type="button" onClick={() => onToggle(true)} className="btn-brutal self-start">
        + Buscar entrenadores cerca
      </button>
    );
  }

  return (
    <div className="card-brutal flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-brutal text-acid">Buscador de entrenadores</p>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
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
            onClick={() => onRadiusChange(km)}
            className={radiusKm === km ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            {km} km
          </button>
        ))}
      </div>
      {center && (
        <MapPicker
          center={center}
          markers={trainerMarkers}
          onMarkerClick={onMarkerClick}
          onMapMove={onMapMove}
          height={280}
        />
      )}
      {trainers.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
      ) : (
        trainers.map((t) => {
          const effectiveStatus = sentRequests.has(t.user_id) ? 'request-sent' : t.status;
          return (
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
                  {t.rate_amount}
                  {t.rate_currency ? ` ${t.rate_currency}` : ''} / {t.rate_period}
                </p>
              )}
              {effectiveStatus === 'connected' && (
                <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
              )}
              {effectiveStatus === 'request-sent' && (
                <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
              )}
              {effectiveStatus === 'request-received' && t.requestId && (
                <button type="button" onClick={() => onAcceptRequest(t.requestId!)} className="btn-brutal-sm">
                  Aceptar
                </button>
              )}
              {effectiveStatus === 'none' && (
                <button
                  type="button"
                  onClick={() => onConnect(t.user_id)}
                  className="btn-brutal-sm self-start"
                >
                  Conectar
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sacar `useMemo` del import de React en `Connections.tsx`** (ya no se usa ahí después de este task)

Reemplazar:

```ts
import { useEffect, useMemo, useState, type FormEvent } from 'react';
```

por:

```ts
import { useEffect, useState, type FormEvent } from 'react';
```

- [ ] **Step 3: Sacar el import de `MapPicker`** (se usa solo en la sección que se mueve a `TrainerSearch.tsx`)

Reemplazar:

```ts
import MapPicker from '../Shared/MapPicker';
import RoutinePreview from '../RoutineManager/RoutinePreview';
```

por:

```ts
import RoutinePreview from '../RoutineManager/RoutinePreview';
```

- [ ] **Step 4: Agregar el import del componente nuevo**

Reemplazar:

```ts
import IncomingRequests from './IncomingRequests';
```

por:

```ts
import IncomingRequests from './IncomingRequests';
import TrainerSearch from './TrainerSearch';
```

- [ ] **Step 5: Sacar el `useMemo` de `trainerMarkers`**

Reemplazar:

```ts
  const trainerMarkers = useMemo(
    () =>
      nearbyTrainers.map((t) => ({
        id: t.user_id,
        lat: t.lat!,
        lng: t.lng!,
        label: t.displayName ?? 'Entrenador',
      })),
    [nearbyTrainers]
  );

  if (!authChecked) {
```

por:

```ts
  if (!authChecked) {
```

- [ ] **Step 6: Usar el componente en el JSX**

Reemplazar:

```tsx
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
              className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
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
              markers={trainerMarkers}
              onMarkerClick={setSelectedTrainerId}
              onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
              height={280}
            />
          )}
          {nearbyTrainers.length === 0 ? (
            <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
          ) : (
            nearbyTrainers.map((t) => {
              const effectiveStatus = sentTrainerRequests.has(t.user_id) ? 'request-sent' : t.status;
              return (
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
                      {t.rate_amount}
                      {t.rate_currency ? ` ${t.rate_currency}` : ''} / {t.rate_period}
                    </p>
                  )}
                  {effectiveStatus === 'connected' && (
                    <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
                  )}
                  {effectiveStatus === 'request-sent' && (
                    <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                  )}
                  {effectiveStatus === 'request-received' && t.requestId && (
                    <button
                      type="button"
                      onClick={() => handleAcceptTrainerRequest(t.requestId!)}
                      className="btn-brutal-sm"
                    >
                      Aceptar
                    </button>
                  )}
                  {effectiveStatus === 'none' && (
                    <button
                      type="button"
                      onClick={() => handleConnectTrainer(t.user_id)}
                      className="btn-brutal-sm self-start"
                    >
                      Conectar
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
```

por:

```tsx
      <TrainerSearch
        open={showTrainerSearch}
        onToggle={setShowTrainerSearch}
        center={trainerCenter}
        onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
        radiusKm={trainerRadiusKm}
        onRadiusChange={setTrainerRadiusKm}
        trainers={nearbyTrainers}
        selectedTrainerId={selectedTrainerId}
        onMarkerClick={setSelectedTrainerId}
        sentRequests={sentTrainerRequests}
        onConnect={handleConnectTrainer}
        onAcceptRequest={handleAcceptTrainerRequest}
      />
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 8: Commit**

```bash
git add src/components/react/Connections/TrainerSearch.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract TrainerSearch from Connections.tsx"
```

---

### Task 6: `PendingRoutineShares`

**Files:**
- Create: `src/components/react/Connections/PendingRoutineShares.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

- [ ] **Step 1: Crear `src/components/react/Connections/PendingRoutineShares.tsx`**

```tsx
import type { PendingRoutineShare } from '../../../lib/routineShares';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import RoutinePreview from '../RoutineManager/RoutinePreview';

interface Props {
  shares: PendingRoutineShare[];
  previewShareId: string | null;
  previewDays: RoutineDays | null;
  actingShareId: string | null;
  error: string | null;
  activities: ActivityOption[];
  onPreview: (share: PendingRoutineShare) => void;
  onAccept: (share: PendingRoutineShare) => void;
  onReject: (shareId: string) => void;
}

export default function PendingRoutineShares({
  shares,
  previewShareId,
  previewDays,
  actingShareId,
  error,
  activities,
  onPreview,
  onAccept,
  onReject,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Rutinas compartidas pendientes</p>
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      {shares.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">No tienes propuestas de rutina pendientes.</p>
      ) : (
        shares.map((share) => (
          <div key={share.shareId} className="card-brutal flex flex-col gap-3">
            <p className="font-mono text-sm text-paper">
              <span className="text-acid">{share.fromDisplayName ?? 'Alguien'}</span> te propuso "
              {share.routineName}"
            </p>
            {previewShareId === share.shareId && previewDays && (
              <RoutinePreview days={previewDays} activities={activities} />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onPreview(share)}
                disabled={actingShareId === share.shareId}
                className="btn-brutal-sm"
              >
                Ver
              </button>
              <button
                type="button"
                onClick={() => onAccept(share)}
                disabled={actingShareId === share.shareId}
                className="btn-brutal-sm border-acid bg-acid text-on-accent"
              >
                {actingShareId === share.shareId ? 'Agregando...' : 'Agregar a mis rutinas'}
              </button>
              <button
                type="button"
                onClick={() => onReject(share.shareId)}
                disabled={actingShareId === share.shareId}
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sacar el import de `RoutinePreview`** (se usa solo en la sección que se mueve)

Reemplazar:

```ts
import RoutinePreview from '../RoutineManager/RoutinePreview';
import InviteLinkCard from './InviteLinkCard';
```

por:

```ts
import InviteLinkCard from './InviteLinkCard';
```

- [ ] **Step 3: Agregar el import del componente nuevo**

Reemplazar:

```ts
import TrainerSearch from './TrainerSearch';
```

por:

```ts
import TrainerSearch from './TrainerSearch';
import PendingRoutineShares from './PendingRoutineShares';
```

- [ ] **Step 4: Usar el componente en el JSX**

Reemplazar:

```tsx
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Rutinas compartidas pendientes</p>
        {shareActionError && <p className="font-mono text-xs text-blood">{shareActionError}</p>}
        {pendingShares.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tienes propuestas de rutina pendientes.</p>
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
                <button
                  type="button"
                  onClick={() => handlePreviewShare(share)}
                  disabled={actingShareId === share.shareId}
                  className="btn-brutal-sm"
                >
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptShare(share)}
                  disabled={actingShareId === share.shareId}
                  className="btn-brutal-sm border-acid bg-acid text-on-accent"
                >
                  {actingShareId === share.shareId ? 'Agregando...' : 'Agregar a mis rutinas'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectShare(share.shareId)}
                  disabled={actingShareId === share.shareId}
                  className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
```

por:

```tsx
      <PendingRoutineShares
        shares={pendingShares}
        previewShareId={previewShareId}
        previewDays={previewDays}
        actingShareId={actingShareId}
        error={shareActionError}
        activities={activities}
        onPreview={handlePreviewShare}
        onAccept={handleAcceptShare}
        onReject={handleRejectShare}
      />
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Connections/PendingRoutineShares.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract PendingRoutineShares from Connections.tsx"
```

---

### Task 7: `MyConnectionsList` (mueve `AssignRoutinePicker`)

**Files:**
- Create: `src/components/react/Connections/MyConnectionsList.tsx`
- Modify: `src/components/react/Connections/Connections.tsx`

**Contexto:** el sub-componente `AssignRoutinePicker` (ya existente en `Connections.tsx`, solo usado en esta sección) se mueve tal cual adentro de `MyConnectionsList.tsx`. Este es el último task de extracción — después de este, `Avatar` deja de usarse en `Connections.tsx` (todas sus apariciones ya se movieron a los componentes de los tasks 3, 4, 5 y este), así que también se saca ese import acá.

- [ ] **Step 1: Crear `src/components/react/Connections/MyConnectionsList.tsx`**

```tsx
import { useState } from 'react';
import type { ConnectionSummary } from '../../../lib/connections';
import { assignRoutineToStudent } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';

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
        <p className="font-mono text-xs text-paper-dim">No tienes rutinas propias para asignar todavía.</p>
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
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );
}

interface Props {
  connections: ConnectionSummary[];
  isTrainer: boolean;
  myRoutines: Routine[];
  onRemove: (connectionId: string) => void;
  onRoutineAssigned: () => void;
}

export default function MyConnectionsList({
  connections,
  isTrainer,
  myRoutines,
  onRemove,
  onRoutineAssigned,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Mis conexiones</p>
      {connections.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">Todavía no tienes ninguna conexión.</p>
      ) : (
        connections.map((c) => (
          <div key={c.connectionId} className="card-brutal flex items-center gap-4">
            <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
            <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
            <div className="flex flex-col items-end gap-2">
              {isTrainer && (
                <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={onRoutineAssigned} />
              )}
              <button
                type="button"
                onClick={() => onRemove(c.connectionId)}
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                Desvincular
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sacar el import de `Avatar`** (ya no se usa directamente en `Connections.tsx`)

Reemplazar:

```ts
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import Avatar from '../Shared/Avatar';
```

por:

```ts
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
```

- [ ] **Step 3: Recortar el import de `../../../lib/routines`** (`assignRoutineToStudent` se movió, `getMyRoutines` sigue usándose en `refresh()`)

Reemplazar:

```ts
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
```

por:

```ts
import { getMyRoutines } from '../../../lib/routines';
```

- [ ] **Step 4: Agregar el import del componente nuevo y quitar la función `AssignRoutinePicker` local**

Reemplazar:

```ts
import PendingRoutineShares from './PendingRoutineShares';

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
        <p className="font-mono text-xs text-paper-dim">No tienes rutinas propias para asignar todavía.</p>
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
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );
}

interface Props {
  activities: ActivityOption[];
}
```

por:

```ts
import PendingRoutineShares from './PendingRoutineShares';
import MyConnectionsList from './MyConnectionsList';

interface Props {
  activities: ActivityOption[];
}
```

- [ ] **Step 5: Usar el componente en el JSX**

Reemplazar:

```tsx
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Mis conexiones</p>
        {connections.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">Todavía no tienes ninguna conexión.</p>
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
                  className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))
        )}
      </div>
```

por:

```tsx
      <MyConnectionsList
        connections={connections}
        isTrainer={isTrainer}
        myRoutines={myRoutines}
        onRemove={handleRemove}
        onRoutineAssigned={refresh}
      />
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 7: Confirmar que `Connections.tsx` bajó de tamaño**

Run: `wc -l src/components/react/Connections/Connections.tsx`
Expected: bastante menos que las ~690 líneas originales (idealmente entre 220 y 260).

- [ ] **Step 8: Commit**

```bash
git add src/components/react/Connections/MyConnectionsList.tsx src/components/react/Connections/Connections.tsx
git commit -m "refactor: extract MyConnectionsList from Connections.tsx"
```

---

### Task 8: Verificación manual end-to-end + documentación

**Files:** `docs/roadmap-ideas.md`, `docs/agents/dividir-connections-status.md` (nuevo)

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en los tasks anteriores.

- [ ] **Step 2: Preparar la cuenta de prueba**

Mismo patrón que sesiones anteriores (ver `docs/agents/notas-de-entorno-y-lecciones.md`): escribir a un archivo y correr

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
```

vía `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode lo bloquea, pedirle al usuario que lo corra con `!`.

- [ ] **Step 3: Playwright — ejercitar los 6 flujos de `/conexiones/`**

Con `npx astro preview` corriendo (build ya hecho en Step 1), loguear con la cuenta de prueba y en `/conexiones/`:

1. **Link de invitación**: si no hay código, click "Generar mi link" y confirmar que aparece un link; click "Copiar link" y confirmar que el botón pasa a decir "Copiado"; click "Regenerar" y confirmar que el link cambia.
2. **Canjear código**: escribir un código inválido en "Conectarme con un código" y confirmar que aparece un mensaje de error (sin romper la página).
3. **Buscar usuarios**: buscar un nombre que no dé resultados y confirmar el mensaje "No se encontraron usuarios."; buscar un nombre real (de otra cuenta de prueba si existe) y confirmar que aparece en la lista con su estado correcto.
4. **Solicitudes de conexión**: confirmar que la sección se renderiza (vacía o con solicitudes reales) sin errores.
5. **Buscador de entrenadores**: click "+ Buscar entrenadores cerca", confirmar que se abre el mapa y el selector de radio (5/10/20/50 km), cambiar el radio y confirmar que el botón activo cambia, click "Cerrar" y confirmar que vuelve a mostrar solo el botón de abrir.
6. **Rutinas compartidas pendientes**: confirmar que la sección se renderiza (vacía o con propuestas reales) sin errores.
7. **Mis conexiones**: confirmar que la lista de conexiones existentes se sigue viendo igual (avatar, nombre, botón "Desvincular", y si la cuenta es entrenador, "Asignar rutina").

No hace falta reproducir cada flujo hasta el final (ej. no hace falta tener una segunda cuenta real para aceptar una solicitud) — el objetivo es confirmar que cada sección renderiza y reacciona a clicks exactamente igual que antes del refactor, no volver a probar la lógica de negocio de conexiones (ya cubierta en `docs/agents/descubrimiento-conexiones-status.md`).

- [ ] **Step 4: Actualizar la documentación de la sesión**

En `docs/roadmap-ideas.md`, dentro del bullet de **Conexiones** en "Deuda técnica / mejoras pendientes", sacar la parte ya resuelta y dejar solo lo que sigue pendiente. Reemplazar:

```md
- **Conexiones** (`descubrimiento-conexiones-status.md`): `Connections.tsx` tiene ~650 líneas / seis secciones en un solo archivo — conviene dividirlo antes de sumarle una séptima; `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones simultáneas (borde muy angosto, sin corrupción de datos); `routine_shares` no tiene constraint único, se puede proponer la misma rutina dos veces.
```

por:

```md
- **Conexiones** (`descubrimiento-conexiones-status.md`, `dividir-connections-status.md`): `acceptRoutineShare` no es atómico contra una carrera real de dos sesiones simultáneas (borde muy angosto, sin corrupción de datos); `routine_shares` no tiene constraint único, se puede proponer la misma rutina dos veces.
```

Crear `docs/agents/dividir-connections-status.md`:

```md
# Dividir Connections.tsx — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — `Connections.tsx` tenía ~690 líneas y seis secciones de UI en un solo archivo. Refactor puro, elegido directamente por el usuario. Proceso: brainstorming (una sola pregunta: qué enfoque de split) → spec (`docs/superpowers/specs/2026-08-20-dividir-connections-design.md`) → plan (`docs/superpowers/plans/2026-08-20-dividir-connections.md`) → implementación con subagent-driven-development, un task por componente.

## Qué se hizo

Se extrajeron 7 componentes de presentación pura (reciben props y callbacks, sin fetch propio) a `src/components/react/Connections/`: `InviteLinkCard`, `RedeemCodeForm`, `UserSearch`, `IncomingRequests`, `TrainerSearch`, `PendingRoutineShares`, `MyConnectionsList` (este último incluye `AssignRoutinePicker`, movido tal cual). `Connections.tsx` sigue siendo dueño de todo el estado, `refresh()`, y los `useEffect` de geolocalización/mapa — solo cambió qué JSX renderiza. `inviteLink()` se movió de una función local a `src/lib/connections.ts` para no duplicarla entre el padre y `InviteLinkCard`.

Mismo patrón que ya usa `RoutineManager.tsx`/`RoutineList.tsx` en este proyecto — no se introdujo una convención nueva.

`Connections.tsx` bajó de ~690 líneas a lo que haya dado `wc -l` en el Task 7, Step 7 — reemplazar esta línea con esa cifra real antes de commitear este documento.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios después de cada uno de los 7 tasks de extracción (único error preexistente esperado en `ProgressList.tsx`, no relacionado).
- Cada task pasó revisión de spec compliance y de calidad de código.
- Playwright contra la cuenta de prueba real, ejercitando los 6 flujos de `/conexiones/` (link de invitación, canjear código, buscar usuarios, solicitudes entrantes, buscador de entrenadores, rutinas compartidas pendientes, mis conexiones) para confirmar cero cambios de comportamiento.

## Lo que falta / no cubierto en esta ronda

- Nada de comportamiento cambió — es puramente estructural. La deuda técnica restante de Conexiones (condición de carrera en `acceptRoutineShare`, falta de constraint único en `routine_shares`) sigue en `docs/roadmap-ideas.md`, sin tocar.
```

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap-ideas.md docs/agents/dividir-connections-status.md
git commit -m "docs: log Connections.tsx split and update roadmap debt list"
```
