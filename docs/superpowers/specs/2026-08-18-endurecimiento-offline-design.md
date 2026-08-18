# Endurecimiento del logueo offline — diseño

Spec 3 de la serie de mejoras técnicas de la sesión de PWA/offline. Aborda los tres límites que `docs/superpowers/specs/2026-08-16-logueo-offline-y-sync-design.md` (spec 2) dejó explícitamente documentados como fuera de alcance, ya mergeado a `main`:

- **Refresco de sesión offline** — si el JWT cacheado vence mientras el dispositivo lleva mucho tiempo sin red, `flushQueue()` falla por auth en vez de sincronizar.
- **Cuota de IndexedDB excedida** — no hay manejo si el navegador rechaza escribir más en la base offline.
- **Coordinación entre pestañas** del mismo origen offline a la vez, ambas escribiendo a la misma IndexedDB sin coordinarse.

**Pedido:** endurecer estos tres puntos, elegidos explícitamente por el usuario para abordarse juntos en una sola ronda (no uno a la vez).

**Explícitamente fuera de esta ronda:**
- Multi-dispositivo en tiempo real / colaboración (sigue siendo el mismo no-objetivo del spec 2 — esta app es de un solo usuario por cuenta).
- Refresco de token manual/explícito — se sigue dependiendo del auto-refresh en segundo plano del SDK de Supabase, no se reimplementa.
- Liberación automática de espacio ante cuota excedida — solo un mensaje claro, sin auto-eviction de caché.
- Cualquier ítem del backlog de negocio en `docs/roadmap-ideas.md`.

## Referencia usada

Se investigó el código real (no solo la documentación) de [rastrum](https://github.com/ArtemioPadilla/rastrum) — mismo proyecto usado como referencia en el spec 1 — específicamente `src/lib/sync.ts` y `src/lib/supabase.ts`, que resuelven el mismo problema (cola offline + Supabase) en una app más madura. Dos decisiones de este spec vienen directamente de ahí, con el razonamiento explicado en cada sección:

1. El lock de sincronización espera (`{ mode: 'exclusive' }`) en vez de rendirse (`ifAvailable: true`) — Rastrum probó la alternativa y documentó en un comentario que "saltarse" el intento cuando otra pestaña está sincronizando puede dejar datos sin sincronizar hasta el próximo trigger, y que ya vieron duplicados reales antes de este cambio.
2. Un guard de sesión explícito al arrancar el flush, antes de tocar la cola — su comentario documenta el mismo síntoma que se encontró en verificación manual de este proyecto (spec 2): sin el guard, un JWT vencido/ausente hace fallar las queries en silencio.

No se encontró manejo de cuota de IndexedDB en Rastrum tampoco — confirma que "mensaje claro, sin auto-liberado" es proporcional a lo que un proyecto de referencia más grande considera necesario, no una simplificación de menos.

## Arquitectura

Los tres arreglos son independientes entre sí, cada uno tocando una capa ya existente del spec 2 — no hay pieza nueva compartida entre ellos:

```
src/lib/offlineQueue.ts
  ├─ isNetworkError()     ← gana un chequeo más (JWT vencido)
  ├─ isQuotaExceededError() ← nuevo, usado solo por enqueue()
  └─ enqueue()            ← envuelto con el chequeo de cuota

src/lib/workouts.ts
  └─ runFlushQueue()       ← gana guard de sesión al arrancar
  └─ flushQueue()          ← envuelve runFlushQueue() en un Web Lock
```

## 1. Sesión vencida durante el flush

**Guard al arrancar** (en `runFlushQueue()`, antes del loop que camina la cola):

```ts
async function runFlushQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return; // sin sesión (vencida o ausente) — esperar al próximo intento

  const tempIdMap = new Map<string, string>();
  // ... resto igual que hoy
}
```

`getSession()` es una llamada local (sin red) — no agrega latencia real. Si no hay sesión, se corta antes de tocar la cola o hacer cualquier llamada de red, dejando todo intacto para el próximo trigger (`online`, `selfgains:queue-changed`, el próximo mount). Mismo patrón que el guard de `syncOutboxInner()` en Rastrum.

**Clasificación ampliada** (para el token que vence *a mitad* de un flush ya en curso, después de pasar el guard de arriba): en `offlineQueue.ts`, `isNetworkError()` gana un chequeo adicional:

```ts
export function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    if (e.code === '' && typeof e.message === 'string' && e.message.startsWith('TypeError:')) {
      return true;
    }
    // JWT vencido en medio de un flush — mismo tratamiento que "sin red":
    // pausar y reintentar después, no tratarlo como conflicto de datos.
    if (e.code === 'PGRST301') return true;
    if (typeof e.message === 'string' && e.message.toLowerCase().includes('jwt expired')) {
      return true;
    }
  }
  return false;
}
```

Al ampliar la función compartida (no crear una nueva), el arreglo beneficia automáticamente tanto a `flushQueue()` como a cualquier intento directo online con token vencido (ej. la laptop volvió de suspender) — ambos caminos ya pasan por el mismo chequeo. No se agrega ningún refresh manual: el SDK de Supabase ya tiene su propio ciclo de auto-refresh en segundo plano; con solo tratar esto igual que "sin red" (pausar, reintentar después), el próximo intento ya encuentra el token renovado solo.

## 2. Cuota de IndexedDB excedida

En `offlineQueue.ts`:

```ts
function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}
```

`enqueue()` se envuelve para traducir este error específico a un mensaje claro:

```ts
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
  window.dispatchEvent(new CustomEvent('selfgains:queue-changed'));
  return { ...full, id };
}
```

Este es el único punto envuelto: es donde un cambio offline real (no un espejo de caché) se pierde si falla. El mensaje ya cae naturalmente en los `catch` existentes de `WorkoutLogger.tsx`/`WorkoutHistory.tsx` (`setError(err instanceof Error ? err.message : ...)`), sin tocar esos componentes.

`writeCache`/`patchCacheArray` (usadas también para el espejo optimista de la UI justo después de encolar, y para la caché de lectura en general) quedan explícitamente afuera: si esas fallan por cuota, el dato real ya está seguro en la cola — degradan en silencio en vez de mostrar un error por algo que no perdió información.

## 3. Coordinación entre pestañas

En `workouts.ts`, `flushQueue()` envuelve el trabajo real en un Web Lock exclusivo:

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

function withSyncLock(fn: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('selfgains-flush-queue', { mode: 'exclusive' }, fn);
  }
  return fn();
}
```

Si otra pestaña ya tiene el lock, esta pestaña **espera** a que termine (no se rinde) — decisión tomada directamente del código de Rastrum, que documentó en un comentario real que la alternativa de "saltarse" el intento (`ifAvailable: true`) puede dejar datos sin sincronizar hasta el próximo trigger. El guard en memoria (`flushInFlight`) que ya existe desde el spec 2 se mantiene tal cual — sigue evitando pedir el lock si esta misma pestaña ya tiene un flush en curso, antes incluso de llegar al Web Lock. En navegadores sin Web Locks (ninguno relevante hoy) `withSyncLock` cae de vuelta a correr `runFlushQueue()` directo, sin lock — el mismo comportamiento que hay ahora.

## Testing

Sin suite automatizada (consistente con el resto del proyecto). Verificación manual vía Playwright contra `astro build && astro preview` con la cuenta de prueba real, siguiendo el mismo patrón usado para verificar el spec 2:

- **Sesión vencida:** simular un JWT vencido (`supabase db query --linked` para forzar la expiración, o mockear el error en el cliente) y confirmar que `flushQueue()` no genera un conflicto falso — la cola queda intacta y el intento se repite sin corromper nada.
- **Cuota:** difícil de simular de forma realista (`storage.estimate()`/`navigator.storage` no se puede forzar a cuota real fácilmente en Playwright) — se verifica llamando `enqueue()` directo desde la consola del navegador con un mock de `db.add` que lance `new DOMException('quota', 'QuotaExceededError')`, confirmando que el mensaje traducido llega correctamente al catch del componente.
- **Multi-pestaña:** dos `BrowserContext` de Playwright (mismo origen, misma sesión), ambos offline, ambos con cambios encolados; reconectar los dos casi simultáneamente y confirmar vía logs/timestamps que solo uno corre el loop de flush a la vez (el otro espera), sin duplicados en Supabase al final.
