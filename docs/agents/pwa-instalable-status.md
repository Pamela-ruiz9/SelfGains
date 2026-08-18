# PWA instalable + fluidez de navegación — estado

La app pasó de "acceso directo al navegador" a instalable de verdad (manifest, íconos, splash, botón de instalación) y con navegación más fluida (transiciones de página, feedback táctil). Spec y plan en `docs/superpowers/specs/2026-08-16-pwa-instalable-y-fluidez-design.md` y `docs/superpowers/plans/2026-08-16-pwa-instalable-y-fluidez.md`. Investigó [rastrum](https://github.com/ArtemioPadilla/rastrum) (Astro estático) como referencia real de PWA antes de diseñar.

## Completado (2026-08-16)

- **Manifest + íconos**: `manifest.webmanifest` con íconos `maskable`, `display: standalone`, `theme_color`; meta tags de iOS standalone. Commit `2fb2938`.
- **Service worker de app-shell**: estrategia HTML network-first, assets hasheados cache-first; escrituras de caché protegidas con `event.waitUntil` (corrección posterior, commit `f5f03a4`). Commit `92b235e`.
- **Botón de instalación**: hook compartido `usePwaInstall`-style que maneja `beforeinstallprompt` en Android/desktop, más un hint aparte para iOS (que no dispara ese evento) — commit `5649c18`. Integrado en Perfil y Registrar — commit `1f11803`.
- **Astro View Transitions** (`<ClientRouter />`, nativo de Astro 5, sin dependencias nuevas) con un fade simple — commit `3db0629`. Deliberadamente **sin** `transition:persist` en el `Nav` (desviación documentada del enfoque original).
- **Feedback táctil**: micro-interacciones en botones, tarjetas y el mensaje de "set guardado" — commit `70d6450`.

## Verificación hecha

- `npm run build && npx tsc --noEmit` limpio en cada tarea, ejecutadas con subagentes (implementador + revisión de spec + revisión de calidad por cada una).
- Verificación manual con Playwright contra `astro build && astro preview` (nunca `astro dev` — el servidor de dev de Vite sirve los islands React como imports ESM en vivo que el service worker no puede cachear de forma confiable, lo que rompía la hidratación en las pruebas offline).

## Lo que falta / limitaciones conocidas

- Logueo de entrenamientos sin conexión y sincronización posterior — explícitamente fuera de esta ronda, cubierto por spec 2, ver `docs/agents/offline-sync-status.md`.
- Nada del backlog de negocio (roles de entrenador, perfil enriquecido, etc.) — ver `docs/roadmap-ideas.md`.

## Si se retoma

- El service worker de app-shell que este spec dejó instalado es la base sobre la que se construyó todo el subsistema de sincronización offline (spec 2) — cualquier cambio a la estrategia de caché debe revisarse contra `docs/agents/offline-sync-status.md` y `docs/agents/offline-sync-hardening-status.md`.
