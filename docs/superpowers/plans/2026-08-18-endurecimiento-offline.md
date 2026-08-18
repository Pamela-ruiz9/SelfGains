# Endurecimiento del logueo offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los tres límites que el spec de logueo offline dejó documentados como fuera de alcance: una sesión vencida durante un flush ya no genera un conflicto falso, una cuota de IndexedDB agotada muestra un mensaje claro en vez de un error genérico, y dos pestañas del mismo origen offline a la vez ya no pueden caminar la cola de sincronización al mismo tiempo.

**Architecture:** Tres cambios independientes sobre dos archivos ya existentes del logueo offline (`src/lib/offlineQueue.ts`, `src/lib/workouts.ts`) — sin archivos nuevos, sin cambios a ningún componente React. `isNetworkError()` gana un chequeo más (JWT vencido), `runFlushQueue()` gana un guard de sesión al arrancar, `enqueue()` traduce una cuota agotada a un mensaje legible, y `flushQueue()` se envuelve en un Web Lock exclusivo (`navigator.locks`) que espera si otra pestaña ya está sincronizando, en vez de rendirse.

**Tech Stack:** TypeScript, `@supabase/supabase-js` (ya en el stack), Web Locks API (`navigator.locks`, soportada nativamente en todos los navegadores modernos objetivo — sin dependencia nueva), Playwright para la verificación manual final.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-18-endurecimiento-offline-design.md`. Las dos decisiones de diseño clave (el lock espera en vez de rendirse; el guard de sesión corre antes de tocar la cola) vienen de leer el código real de un proyecto de referencia (rastrum) que resolvió el mismo problema — el spec documenta el razonamiento completo, no hace falta releerlo acá.

---

### Task 1: Sesión vencida durante el flush

**Files:**
- Modify: `src/lib/offlineQueue.ts`
- Modify: `src/lib/workouts.ts`

- [ ] **Step 1: Ampliar `isNetworkError()` para reconocer un JWT vencido**

En `src/lib/offlineQueue.ts`, reemplazar:

```ts
export function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    return e.code === '' && typeof e.message === 'string' && e.message.startsWith('TypeError:');
  }
  return false;
}
```

por:

```ts
export function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    if (e.code === '' && typeof e.message === 'string' && e.message.startsWith('TypeError:')) {
      return true;
    }
    // JWT vencido en medio de un flush — mismo tratamiento que "sin red":
    // pausar y reintentar después, no tratarlo como conflicto de datos. El
    // SDK de Supabase refresca el token solo en segundo plano; para cuando
    // se reintente, ya debería estar renovado.
    if (e.code === 'PGRST301') return true;
    if (typeof e.message === 'string' && e.message.toLowerCase().includes('jwt expired')) {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 2: Agregar el guard de sesión al arrancar `runFlushQueue()`**

En `src/lib/workouts.ts`, reemplazar:

```ts
async function runFlushQueue(): Promise<void> {
  if (!navigator.onLine) return;
  const tempIdMap = new Map<string, string>();
```

por:

```ts
async function runFlushQueue(): Promise<void> {
  if (!navigator.onLine) return;
  // Sin esto, un JWT vencido/ausente hace que la primera llamada de la cola
  // falle en silencio con un error de auth en vez de simplemente esperar —
  // se corta acá, antes de tocar la cola, para el próximo intento (mismo
  // patrón usado por rastrum en su guard equivalente).
  if (!(await getCurrentUserId())) return;
  const tempIdMap = new Map<string, string>();
```

`getCurrentUserId()` ya existe en este archivo (usa `supabase.auth.getSession()`, una llamada local sin red) — no hace falta importar nada nuevo ni duplicar el chequeo de sesión.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx` (confirmado en sesiones anteriores — el número de línea puede variar según cambios previos en ese archivo, no es señal de alarma).

- [ ] **Step 4: Commit**

```bash
git add src/lib/offlineQueue.ts src/lib/workouts.ts
git commit -m "feat: treat expired-session failures during flush like a network error"
```

---

### Task 2: Cuota de IndexedDB excedida

**Files:**
- Modify: `src/lib/offlineQueue.ts`

- [ ] **Step 1: Agregar `isQuotaExceededError()` y envolver `enqueue()`**

Reemplazar:

```ts
export async function enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<QueueItem> {
  const db = await getOfflineDb();
  const full: Omit<QueueItem, 'id'> = { ...item, createdAt: new Date().toISOString() };
  const id = await db.add('queue', full as QueueItem);
  // A diferencia de un sync exitoso (que dispara selfgains:sync-complete al
  // terminar), nada más avisa cuando se agrega un item nuevo a la cola
  // mientras la página ya está montada offline — sin esto, el SyncBanner no
  // se entera de que hay algo pendiente hasta el próximo mount/reconexión.
  window.dispatchEvent(new CustomEvent('selfgains:queue-changed'));
  return { ...full, id: id as number };
}
```

por:

```ts
function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<QueueItem> {
  const db = await getOfflineDb();
  const full: Omit<QueueItem, 'id'> = { ...item, createdAt: new Date().toISOString() };
  let id: number;
  try {
    id = (await db.add('queue', full as QueueItem)) as number;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error('No se pudo guardar sin conexión: el dispositivo se quedó sin espacio de almacenamiento.');
    }
    throw err;
  }
  // A diferencia de un sync exitoso (que dispara selfgains:sync-complete al
  // terminar), nada más avisa cuando se agrega un item nuevo a la cola
  // mientras la página ya está montada offline — sin esto, el SyncBanner no
  // se entera de que hay algo pendiente hasta el próximo mount/reconexión.
  window.dispatchEvent(new CustomEvent('selfgains:queue-changed'));
  return { ...full, id };
}
```

Deliberadamente **no** se envuelven `writeCache`/`patchCacheArray` con este mismo chequeo — son la caché de lectura y el espejo optimista de la UI, no la escritura real; si esas fallan por cuota, el cambio del usuario ya está seguro en la cola (o ya se guardó en el servidor), así que degradan en silencio en vez de mostrar un error por algo que no perdió información.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el mismo error preexistente de `ProgressList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offlineQueue.ts
git commit -m "feat: show a clear message when IndexedDB quota is exceeded while queueing offline"
```

---

### Task 3: Coordinación entre pestañas

**Files:**
- Modify: `src/lib/workouts.ts`

- [ ] **Step 1: Envolver `flushQueue()` en un Web Lock exclusivo**

Reemplazar:

```ts
let flushInFlight: Promise<void> | null = null;

export function flushQueue(): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = runFlushQueue().finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}
```

por:

```ts
let flushInFlight: Promise<void> | null = null;

export function flushQueue(): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = withSyncLock(runFlushQueue).finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}

// Si otra pestaña del mismo origen ya está corriendo runFlushQueue(), esta
// pestaña ESPERA a que termine en vez de rendirse (sin `ifAvailable`) — con
// `ifAvailable` un cambio podía quedar sin sincronizar hasta el próximo
// trigger si la otra pestaña no volvía a intentarlo. El guard en memoria de
// flushInFlight de arriba sigue evitando pedir el lock si esta misma
// pestaña ya tiene un flush en curso. Sin Web Locks (ningún navegador
// objetivo hoy) cae de vuelta a correr runFlushQueue() directo, sin lock —
// el mismo comportamiento que había antes de esta tarea.
function withSyncLock(fn: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('selfgains-flush-queue', { mode: 'exclusive' }, fn);
  }
  return fn();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el mismo error preexistente de `ProgressList.tsx` — si aparece un error nuevo sobre `navigator.locks` (tipo no reconocido), es porque el `lib` de `tsconfig.json` no incluye los tipos de Web Locks; en ese caso, agregar una declaración local mínima en el mismo archivo en vez de modificar `tsconfig.json`:

```ts
declare global {
  interface LockManager {
    request<T>(name: string, options: { mode: 'exclusive' | 'shared' }, callback: () => Promise<T>): Promise<T>;
  }
  interface Navigator {
    locks?: LockManager;
  }
}
```

(Colocar este bloque cerca del final del archivo, después de los imports. Solo agregarlo si `tsc` realmente falla sin él — los navegadores objetivo y las versiones recientes de TypeScript ya suelen traer estos tipos incluidos.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/workouts.ts
git commit -m "feat: coordinate flushQueue across same-origin tabs with a Web Lock"
```

---

### Task 4: Verificación manual

Sin suite de tests automatizada (consistente con el resto del proyecto). Usa la cuenta de prueba ya confirmada de sesiones anteriores (`crud-e2e-1786826288@gmail.com` — ver `docs/agents/notas-de-entorno-y-lecciones.md` para el patrón de reuso; el reseteo de contraseña vía `supabase db query --linked` puede estar bloqueado en sesiones de background/auto-mode, en cuyo caso avisar al usuario en vez de buscar un rodeo).

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, 11 páginas (sin cambio en el conteo — esta ronda no agrega páginas). Único error de `tsc` el preexistente de `ProgressList.tsx`.

- [ ] **Step 2: Matar procesos huérfanos, levantar `astro preview`**

```bash
ps aux | grep -E "astro dev|astro preview|esbuild" | grep -v grep
```
Matar cualquier proceso de una corrida anterior con `kill -9 <pid>`. Usar `astro build && astro preview` (no `astro dev`) — el service worker de app-shell del spec 1 no cachea de forma confiable los módulos servidos en caliente por el dev server, lo que rompe cualquier verificación offline de una página no cargada aún (ver la nota de esta misma lección en la verificación del spec 2).

```bash
npm run build
npx astro preview --port 4327 &
sleep 3
```

- [ ] **Step 3: Verificar el guard de sesión (JWT vencido no genera un conflicto falso)**

No hay forma directa de forzar que Supabase emita un JWT ya vencido desde el cliente sin esperar la hora real de expiración. Se verifica en su lugar el caso equivalente y sí reproducible: sesión ausente al momento de arrancar el flush — exactamente lo que el guard nuevo intercepta.

```python
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4327/SelfGains"
EMAIL = "crud-e2e-1786826288@gmail.com"
PASSWORD = "TestPass123!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()

    page.goto(f"{BASE}/login/")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)

    page.goto(f"{BASE}/registro/nuevo/")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    ctx.set_offline(True)
    page.get_by_label("Reps").fill("7")
    page.get_by_label("Peso (kg)").fill("30")
    page.click('button:text-is("+ Agregar")')
    page.wait_for_timeout(300)
    page.click('button:text-is("Guardar entrenamiento")')
    page.wait_for_timeout(800)

    # Simular sesión vencida/ausente: borrar el token de auth de localStorage
    # (la clave real depende del proyecto Supabase — filtramos por 'auth-token').
    page.evaluate("""
        () => {
            Object.keys(localStorage)
                .filter((k) => k.includes('auth-token'))
                .forEach((k) => localStorage.removeItem(k));
        }
    """)

    ctx.set_offline(False)
    page.evaluate("window.dispatchEvent(new Event('online'))")
    page.wait_for_timeout(2000)

    counts = page.evaluate("""
        async () => {
            const req = indexedDB.open('selfgains-offline');
            const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
            async function count(store) {
                const tx = db.transaction(store, 'readonly');
                return await new Promise((res, rej) => { const r = tx.objectStore(store).count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
            }
            return { queue: await count('queue'), conflicts: await count('conflicts') };
        }
    """)
    print("after flush attempt with no session:", counts)
    # Expected: {'queue': 1, 'conflicts': 0} — el item sigue en cola, sin
    # conflicto falso generado.

    ctx.close()
    browser.close()
```

Expected: la impresión final muestra `queue: 1, conflicts: 0` — el guard cortó el flush antes de tocar la red, sin generar un conflicto falso. (No hace falta un paso separado de "restaurar sesión y confirmar sync" — eso ya lo cubre el Task 8 del plan de spec 2, que verificó el camino feliz de principio a fin.)

- [ ] **Step 4: Verificar el mensaje de cuota excedida**

Se inyecta un monkey-patch de `IDBObjectStore.prototype.add` ANTES de que cargue cualquier script de la página (`page.add_init_script`), para que la próxima vez que `enqueue()` intente escribir en el store `queue` reciba un `QuotaExceededError` real.

```python
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4327/SelfGains"
EMAIL = "crud-e2e-1786826288@gmail.com"
PASSWORD = "TestPass123!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()
    page.add_init_script("""
        const origAdd = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...args) {
            if (this.name === 'queue') {
                throw new DOMException('Simulated quota', 'QuotaExceededError');
            }
            return origAdd.apply(this, args);
        };
    """)

    page.goto(f"{BASE}/login/")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)

    page.goto(f"{BASE}/registro/nuevo/")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    ctx.set_offline(True)
    page.get_by_label("Reps").fill("7")
    page.get_by_label("Peso (kg)").fill("30")
    page.click('button:text-is("+ Agregar")')
    page.wait_for_timeout(300)
    page.click('button:text-is("Guardar entrenamiento")')
    page.wait_for_timeout(800)

    error_text = page.locator("p.border-l-2.border-blood")
    print("error shown:", error_text.first.inner_text() if error_text.count() else "NONE")

    ctx.close()
    browser.close()
```

Expected: `error shown: No se pudo guardar sin conexión: el dispositivo se quedó sin espacio de almacenamiento.`

- [ ] **Step 5: Verificar la coordinación multi-pestaña**

Importante: dos pestañas reales comparten IndexedDB porque están en el mismo perfil de navegador. En Playwright eso se simula con **dos `Page` dentro del mismo `BrowserContext`** (`context.new_page()` dos veces) — no con dos `BrowserContext` distintos, que tienen storage aislado entre sí (eso es lo que se usó para simular "dos dispositivos" al verificar conflictos en el spec 2, un caso distinto a propósito).

```python
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4327/SelfGains"
EMAIL = "crud-e2e-1786826288@gmail.com"
PASSWORD = "TestPass123!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()  # un solo contexto = IndexedDB compartida, como dos tabs reales

    page_a = ctx.new_page()
    page_a.goto(f"{BASE}/login/")
    page_a.wait_for_load_state("networkidle")
    page_a.fill('input[type="email"]', EMAIL)
    page_a.fill('input[type="password"]', PASSWORD)
    page_a.click('button[type="submit"]')
    page_a.wait_for_timeout(3000)
    page_a.goto(f"{BASE}/registro/nuevo/")
    page_a.wait_for_load_state("networkidle")
    page_a.wait_for_timeout(500)

    page_b = ctx.new_page()
    page_b.goto(f"{BASE}/registro/nuevo/")  # misma sesión (localStorage compartido)
    page_b.wait_for_load_state("networkidle")
    page_b.wait_for_timeout(500)

    ctx.set_offline(True)  # afecta a las dos páginas del contexto

    page_a.get_by_label("Reps").fill("11")
    page_a.get_by_label("Peso (kg)").fill("31")
    page_a.click('button:text-is("+ Agregar")')
    page_a.wait_for_timeout(300)
    page_a.click('button:text-is("Guardar entrenamiento")')
    page_a.wait_for_timeout(500)

    page_b.get_by_label("Reps").fill("12")
    page_b.get_by_label("Peso (kg)").fill("32")
    page_b.click('button:text-is("+ Agregar")')
    page_b.wait_for_timeout(300)
    page_b.click('button:text-is("Guardar entrenamiento")')
    page_b.wait_for_timeout(500)

    queue_count_before = page_a.evaluate("""
        async () => {
            const req = indexedDB.open('selfgains-offline');
            const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
            const tx = db.transaction('queue', 'readonly');
            return await new Promise((res, rej) => { const r = tx.objectStore('queue').count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        }
    """)
    print("queue count before reconnect (expect 4: 2 createWorkout + 2 addSet):", queue_count_before)

    ctx.set_offline(False)
    # Disparar el evento 'online' en ambas páginas casi al mismo tiempo —
    # el escenario que el lock tiene que resolver sin duplicar nada.
    page_a.evaluate("window.dispatchEvent(new Event('online'))")
    page_b.evaluate("window.dispatchEvent(new Event('online'))")
    page_a.wait_for_timeout(4000)

    queue_count_after = page_a.evaluate("""
        async () => {
            const req = indexedDB.open('selfgains-offline');
            const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
            const tx = db.transaction('queue', 'readonly');
            return await new Promise((res, rej) => { const r = tx.objectStore('queue').count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        }
    """)
    print("queue count after both tabs reconnect (expect 0):", queue_count_after)

    ctx.close()
    browser.close()
```

Expected: `queue_count_before` es 4 (2 `createWorkout` + 2 `addSet`, uno de cada pestaña), `queue_count_after` es 0 — toda la cola compartida se vació sin errores.

Luego confirmar contra el proyecto real que no quedaron filas duplicadas:

```bash
supabase db query --linked "SELECT ws.reps, ws.weight, COUNT(*) FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id WHERE ws.reps IN (11, 12) AND ws.weight IN (31, 32) GROUP BY ws.reps, ws.weight;"
```
Expected: dos filas, cada una con `count = 1` — ni el set de 11×31 ni el de 12×32 aparecen duplicados pese a que las dos pestañas dispararon el reconecte casi al mismo tiempo.

- [ ] **Step 6: Limpieza**

```bash
kill %1
ps aux | grep -E "astro preview|esbuild" | grep -v grep
```
Matar cualquier proceso que haya quedado colgado.
