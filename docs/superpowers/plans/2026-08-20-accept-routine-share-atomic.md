# acceptRoutineShare atómico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos llamadas concurrentes a `acceptRoutineShare(shareId)` para la misma propuesta nunca pueden crear dos copias de la rutina — como mucho una gana, la otra aborta antes de copiar nada. Si la copia falla después de reclamar la propuesta, la propuesta vuelve a `pending` en vez de quedar `accepted` sin rutina copiada.

**Architecture:** Reordenar `acceptRoutineShare` en `src/lib/routineShares.ts`: el `UPDATE` condicional (`status='pending'` → `'accepted'`) pasa a ser el primer paso (reemplaza también al `SELECT` inicial, devolviendo `routine_id` en la misma llamada) en vez del último. Solo la llamada que gana esa actualización condicional llega al `INSERT` de la copia; si el `INSERT` falla, se revierte el `UPDATE` antes de relanzar el error. Sin funciones RPC ni transacciones — sigue siendo una secuencia de llamadas `supabase.from(...)`.

**Tech Stack:** Supabase (Postgres + RLS + PostgREST, ya en el stack) — sin dependencias nuevas, sin cambio de schema, sin cambio de UI.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-20-accept-routine-share-atomic-design.md`.

---

## File Structure

- **Modify:** `src/lib/routineShares.ts` — reordenar `acceptRoutineShare`.

---

### Task 1: Reordenar acceptRoutineShare

**Files:**
- Modify: `src/lib/routineShares.ts`

- [ ] **Step 1: Reemplazar la función completa**

Reemplazar:

```ts
export async function acceptRoutineShare(shareId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  // Se lee `routine_id` de la propia fila de la propuesta (acotado a
  // `to_user_id = auth.uid()` y `status = 'pending'`) en vez de confiarlo
  // como parámetro — mismo motivo que la corrección de
  // acceptConnectionRequest en src/lib/connectionRequests.ts: sin esto,
  // alguien podría pasar un shareId y un routineId que no se correspondan
  // entre sí y terminar marcando como aceptada una propuesta distinta de
  // la rutina que realmente copió.
  const { data: share, error: shareError } = await supabase
    .from('routine_shares')
    .select('routine_id')
    .eq('id', shareId)
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .single();
  if (shareError) throw shareError;

  const source = await getSharedRoutinePreview(share.routine_id);
  if (!source) throw new Error('No se encontró la rutina compartida.');

  // Sin .select() después del insert, mismo motivo que
  // assignRoutineToStudent en src/lib/routines.ts: nada del lado del
  // cliente necesita la fila de vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) throw insertError;

  // .eq('status', 'pending') además de .eq('id', shareId): si dos llamadas
  // concurrentes (doble click, dos pestañas) pasan el SELECT de arriba
  // mientras la propuesta seguía pendiente, esta segunda condición hace
  // que la segunda UPDATE no afecte ninguna fila — se detecta abajo y se
  // aborta en vez de dejar dos copias de la misma rutina creadas para una
  // sola propuesta.
  const { data: updated, error: updateError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId)
    .eq('status', 'pending')
    .select('id');
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    throw new Error('Esta propuesta ya se resolvió en otro lado.');
  }
}
```

por:

```ts
export async function acceptRoutineShare(shareId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  // Reclama la propuesta atómicamente antes de copiar nada: el UPDATE
  // condicional (.eq('status', 'pending')) solo puede afectar la fila una
  // vez, así que si dos llamadas concurrentes (doble click, dos pestañas)
  // llegan acá al mismo tiempo, como mucho una gana y sigue — la otra ve 0
  // filas afectadas y aborta antes de insertar ninguna copia de la rutina.
  // Reemplaza al SELECT que existía antes: el mismo UPDATE ya devuelve
  // routine_id, scoped a to_user_id = auth.uid() (mismo motivo que antes:
  // sin este scoping, alguien podría pasar un shareId ajeno).
  const { data: claimed, error: claimError } = await supabase
    .from('routine_shares')
    .update({ status: 'accepted' })
    .eq('id', shareId)
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .select('routine_id')
    .single();
  if (claimError) throw new Error('Esta propuesta ya se resolvió en otro lado.');

  const source = await getSharedRoutinePreview(claimed.routine_id);
  if (!source) {
    // Revertir el reclamo: sin esto, la propuesta quedaría "accepted" para
    // siempre sin que el usuario tenga la rutina copiada, sin forma de
    // reintentar.
    await supabase.from('routine_shares').update({ status: 'pending' }).eq('id', shareId);
    throw new Error('No se encontró la rutina compartida.');
  }

  // Sin .select() después del insert, mismo motivo que
  // assignRoutineToStudent en src/lib/routines.ts: nada del lado del
  // cliente necesita la fila de vuelta.
  const { error: insertError } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name: source.name, days: source.days });
  if (insertError) {
    await supabase.from('routine_shares').update({ status: 'pending' }).eq('id', shareId);
    throw insertError;
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/routineShares.ts
git commit -m "fix: make acceptRoutineShare atomic against concurrent accept calls"
```

---

### Task 2: Verificación manual end-to-end + documentación

**Files:** `docs/roadmap-ideas.md`, `docs/agents/accept-routine-share-atomic-status.md` (nuevo)

**Contexto:** este flujo necesita dos cuentas conectadas entre sí. Reusar `crud-e2e-1786826288@gmail.com` (A) y `rutinastest1786031687911@gmail.com` (B) — ya quedaron conectadas por la ronda anterior (`docs/agents/routine-shares-unique-constraint-status.md`); si al loguear ya no lo están, reconectarlas primero (código de invitación desde el Perfil/Conexiones de una de las dos).

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

- [ ] **Step 3: Playwright — flujo normal (una sola aceptación) sigue funcionando**

Con `npx astro preview` corriendo (build ya hecho en Step 1): loguear como cuenta A, ir a `/rutinas/`, elegir una rutina propia, "Compartir" a la cuenta B. Loguear como cuenta B, ir a `/conexiones/`, en "Rutinas compartidas pendientes" click "Agregar a mis rutinas" sobre esa propuesta. Confirmar: la propuesta desaparece de pendientes, y en `/rutinas/` de la cuenta B aparece una rutina nueva con el mismo nombre que la original.

- [ ] **Step 4: Verificación directa de la carrera — dos requests concurrentes reales**

Un test de UI con dos clicks humanos no prueba nada de forma confiable (la latencia de red casi siempre alcanza para serializarlos). Para probar la atomicidad real, hay que disparar dos requests HTTP concurrentes de verdad contra el mismo `UPDATE` que ahora hace `acceptRoutineShare`, usando el token real de una sesión logueada.

Script Python (usa `playwright` para loguear y sacar el token de sesión, y `requests` con `ThreadPoolExecutor` para disparar las dos requests al mismo tiempo — ambas dependencias ya están disponibles en este entorno vía el resto de la suite de verificación de este proyecto):

```python
import json
import os
from concurrent.futures import ThreadPoolExecutor

import requests
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4321/SelfGains"
EMAIL_B = "rutinastest1786031687911@gmail.com"
PASS_B = "<misma clave usada en el Step 2 para la cuenta B>"

SUPABASE_URL = "<valor de PUBLIC_SUPABASE_URL, ver .env>"
SUPABASE_ANON_KEY = "<valor de PUBLIC_SUPABASE_ANON_KEY, ver .env>"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', EMAIL_B)
    page.fill('input[type="password"]', PASS_B)
    page.click('button[type="submit"]')
    page.wait_for_url("**/registro/nuevo/**", timeout=15000)

    # supabase-js guarda la sesión en localStorage bajo una key
    # "sb-<project-ref>-auth-token" con un JSON que incluye access_token.
    storage = page.evaluate("() => Object.entries(localStorage)")
    auth_entry = next(v for k, v in storage if k.startswith("sb-") and k.endswith("-auth-token"))
    session = json.loads(auth_entry)
    access_token = session["access_token"]
    user_id = session["user"]["id"]
    browser.close()

# Reemplazar <SHARE_ID> por el id de una propuesta real pendiente de A a B
# (obtenerlo con: supabase db query --linked "select id from routine_shares
# rs join auth.users u on u.id = rs.to_user_id where u.email = '...' and
# rs.status = 'pending';" después de repetir el "Compartir" del Step 3 con
# otra rutina, o la misma si ya se resolvió).
SHARE_ID = "<share id pendiente>"

url = f"{SUPABASE_URL}/rest/v1/routine_shares"
headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
params = {"id": f"eq.{SHARE_ID}", "to_user_id": f"eq.{user_id}", "status": "eq.pending"}


def try_claim():
    r = requests.patch(url, headers=headers, params=params, json={"status": "accepted"})
    return r.status_code, r.json()


with ThreadPoolExecutor(max_workers=2) as executor:
    results = list(executor.map(lambda _: try_claim(), range(2)))

for status, body in results:
    print(status, body)

winners = [r for r in results if isinstance(r[1], list) and len(r[1]) > 0]
print("Requests que reclamaron la fila:", len(winners))
```

Expected: de las dos requests, **exactamente una** devuelve una lista con 1 fila (ganó el `UPDATE`), la otra devuelve una lista vacía (0 filas afectadas, no hubo error HTTP — PostgREST devuelve 200 con `[]` cuando el filtro no matchea nada). Esto prueba directamente que el `UPDATE` condicional es atómico a nivel de base de datos, independiente de cualquier timing de UI.

- [ ] **Step 5: Confirmar que no quedó una copia de rutina duplicada**

```bash
supabase db query --linked "select r.id, r.name, r.created_at from routines r join auth.users u on u.id = r.user_id where u.email = 'rutinastest1786031687911@gmail.com' order by r.created_at desc limit 5;"
```

Expected: como mucho una fila nueva con el nombre de la rutina de prueba usada en el Step 4 (la copia real, hecha por el flujo completo si se llegó a ejecutar `acceptRoutineShare` end-to-end en vez de solo el `PATCH` crudo — si el Step 4 se hizo directo contra la API sin pasar por `getSharedRoutinePreview`+`insert`, no debería haber ninguna fila nueva de `routines` en absoluto, solo el `routine_shares.status` cambiado a `accepted`; eso también es una confirmación válida de que el `UPDATE` es lo único que se ejecutó).

- [ ] **Step 6: Confirmar la ruta de reversión por inspección de código**

Forzar en vivo que el `insert` a `routines` falle (ej. rompiendo RLS temporalmente) no vale la pena para este caso — es un cambio de infraestructura solo para probar un `catch`. En vez de eso, confirmar por lectura directa del archivo ya commiteado en el Task 1 que la ruta de reversión existe y es correcta:

```bash
grep -n "status: 'pending'" src/lib/routineShares.ts
```

Expected: dos apariciones dentro de `acceptRoutineShare` — una en el bloque `if (!source) { ... }` (revierte si no se encontró la rutina original) y otra en el bloque `if (insertError) { ... }` (revierte si el insert de la copia falla) — ambas justo antes de un `throw`, confirmando que ningún camino de error dentro de la función deja la propuesta en `accepted` sin que la copia se haya creado de verdad.

- [ ] **Step 7: Restaurar el estado de las cuentas de prueba**

Si el Step 4 dejó la propuesta en `accepted` sin una copia real de la rutina (porque se probó solo el `PATCH` crudo, no el flujo completo), no hace falta revertir nada — `routine_shares` ya no se vuelve a mostrar como pendiente y no bloquea nada futuro. Si quedó alguna propuesta pendiente sin resolver de los Steps 3-4, rechazarla desde la cuenta B para no dejar basura de prueba acumulada.

- [ ] **Step 8: Actualizar la documentación de la sesión**

En `docs/roadmap-ideas.md`, el bullet de **Conexiones** queda sin ítems de deuda técnica después de este fix — sacarlo de la lista por completo si no queda nada más ahí, o dejar solo lo que siga pendiente. Revisar el archivo actual antes de editar, puede haber cambiado desde que se escribió este plan.

Crear `docs/agents/accept-routine-share-atomic-status.md`:

````md
# acceptRoutineShare atómico — status

**Fecha:** 2026-08-20
**Pedido:** último ítem de deuda técnica de Conexiones en `docs/roadmap-ideas.md` — `acceptRoutineShare` no era atómico contra dos llamadas concurrentes aceptando la misma propuesta, podía crear dos copias de la rutina. Elegido directamente por el usuario. Proceso: brainstorming (una pregunta: reordenar vs. RPC de Postgres) → spec (`docs/superpowers/specs/2026-08-20-accept-routine-share-atomic-design.md`) → plan (`docs/superpowers/plans/2026-08-20-accept-routine-share-atomic.md`) → implementación con subagent-driven-development.

## Qué se hizo

Se reordenó `acceptRoutineShare` (`src/lib/routineShares.ts`): el `UPDATE` condicional (`status='pending'` → `'accepted'`) pasa a ser el primer paso, no el último — reemplaza también al `SELECT` inicial, devolviendo `routine_id` en la misma llamada. Solo la llamada que gana esa actualización condicional llega a copiar la rutina; la perdedora ve 0 filas afectadas y aborta ahí mismo, antes de insertar nada. Si el insert de la copia falla después de reclamar, se revierte el estado a `pending` para que la propuesta quede reintentable en vez de "aceptada" sin rutina copiada. Sin funciones RPC ni transacciones — sigue siendo una secuencia de llamadas `supabase.from(...)`, mismo patrón que el resto del proyecto.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios.
- Playwright: flujo normal de aceptar una propuesta (sin carrera) sigue funcionando igual que antes.
- Prueba directa de la carrera real: dos requests HTTP concurrentes (no dos clicks de UI, que no garantizan simultaneidad real) contra el mismo `UPDATE` condicional, usando el token real de una sesión logueada — confirmado que exactamente una de las dos reclama la fila, la otra ve 0 filas afectadas sin error.
- Confirmado por consulta directa a la base que no se creó una copia de rutina duplicada.

## Lo que falta / no cubierto en esta ronda

- Nada — este era el último ítem de deuda técnica de Conexiones en `docs/roadmap-ideas.md`.
````

- [ ] **Step 9: Commit**

```bash
git add docs/roadmap-ideas.md docs/agents/accept-routine-share-atomic-status.md
git commit -m "docs: log acceptRoutineShare atomicity fix"
```
