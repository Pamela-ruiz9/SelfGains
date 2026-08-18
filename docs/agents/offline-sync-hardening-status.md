# Endurecimiento del logueo offline — estado

Spec 3 de la serie de mejoras técnicas de PWA/offline, aborda los tres límites que spec 2 (`docs/agents/offline-sync-status.md`) dejó explícitamente documentados como fuera de alcance — elegidos por el usuario para atacarse juntos en una sola ronda, no uno a la vez. Spec y plan en `docs/superpowers/specs/2026-08-18-endurecimiento-offline-design.md` y `docs/superpowers/plans/2026-08-18-endurecimiento-offline.md`. Investigó cómo [rastrum](https://github.com/ArtemioPadilla/rastrum) maneja lo offline (patrón de Web Lock, patrón de guarda de sesión) antes de cerrar el diseño.

## Completado (2026-08-18)

- **Refresco de sesión offline**: si el JWT cacheado vence mientras el dispositivo lleva mucho tiempo sin red, `flushQueue()` fallaba por auth en vez de sincronizar — ahora una falla de sesión expirada durante el flush se trata igual que un error de red (reintenta más tarde en vez de descartar). Commit `6f5d5b5`.
- **Cuota de IndexedDB excedida**: mensaje claro al usuario cuando el navegador rechaza escribir más en la cola offline (sin auto-liberación de espacio — decisión explícita de alcance, ver abajo). Commit `15d57f7`.
- **Coordinación entre pestañas**: `navigator.locks` (Web Locks API, modo `exclusive`, sin `ifAvailable` — espera en vez de saltear, validado contra el código real de rastrum) coordina `flushQueue()` entre pestañas del mismo origen para que no escriban a la misma IndexedDB sin coordinarse. Commit `5c32c4c`.

## Verificación hecha

- `npm run build && npx tsc --noEmit` limpio en cada tarea, subagentes (implementador + revisión de spec + revisión de calidad).
- Bug de inferencia de TypeScript real con `navigator.locks.request<T>` (el tipo builtín de `LockManager.request` producía `Promise<Promise<void>>` para un callback que devuelve `Promise<void>` — confirmado por dos revisores independientes reproduciéndolo) — corregido con un bloque `declare global` que el plan ya había pre-autorizado como contingencia.
- Verificación manual con Playwright multi-pestaña contra la base Supabase real: dos pestañas offline simultáneas, ambas encolando cambios, reconexión, confirmando que la cola termina en 0 sin duplicados (`verify_multitab.py`, patrón reusable documentado).
- Supabase auth-js internals verificados leyendo el código fuente real (`node_modules/@supabase/auth-js`), no asumidos: ni `getSession()` ni `getUser()` lanzan excepción en fallo de red/refresh — ambos devuelven `{data, error}`.

## Lo que falta / limitaciones conocidas (alcance explícitamente recortado)

- Multi-dispositivo en tiempo real / colaboración — sigue siendo el mismo no-objetivo de spec 2.
- Refresco de token manual/explícito — se sigue dependiendo del auto-refresh en segundo plano del SDK de Supabase, no se reimplementa.
- Liberación automática de espacio ante cuota excedida — solo un mensaje claro, sin auto-eviction de caché.
- Nada del backlog de negocio en `docs/roadmap-ideas.md`.
