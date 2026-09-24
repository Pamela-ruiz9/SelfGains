# Cierre bilingüe: PWA en inglés, tests en el CI y una errata

Lote chico posterior a las Rondas 1 y 2 (`2026-09-23-bilingue-es-en-design.md`, `2026-09-24-bilingue-contenido-design.md`). Cubre lo que esas rondas dejaron fuera a propósito y que sigue visible: la PWA instalada en inglés, y un hueco del CI.

## Decisiones tomadas en el brainstorming

- **Manifest:** dos manifests, uno por idioma (no uno solo, no dejarlo como está).
- **Service worker, CI y errata:** cambios de una línea sin decisiones de diseño; se hacen sin más.

## Alcance

1. Manifest en inglés.
2. Service worker: precachear la home en inglés.
3. CI: correr `npm test` antes del build.
4. Errata `mantendiendo` → `manteniendo` en `src/content/activities/natacion-crol-fingertip-drag.md`.

Fuera de alcance: emails de Supabase (se configuran desde el dashboard), nombre/iconos/colores del manifest, el resto de la estrategia de caché.

## Diseño

### 1. Manifests

- Nuevo `public/manifest.en.webmanifest`, copia del actual con: `lang: "en"`, `description: "Log workouts, routines and progress — gym, running, swimming and combat sports."`, `start_url: "/SelfGains/en/"`.
- Ambos manifests (`manifest.webmanifest` y `manifest.en.webmanifest`) llevan `"id": "/SelfGains/"`. Hoy el navegador deduce el id de `start_url` (`/SelfGains/`), así que fijarlo explícitamente da la misma identidad: las instalaciones existentes no cambian, y el manifest en inglés no se convierte en una app distinta instalable por separado.
- `scope` sigue siendo `/SelfGains/` en ambos (debe contener a `start_url`). `name` y `short_name` siguen siendo "SelfGains"; iconos y colores no cambian.
- El manifest se fija en el momento de instalar: quien instala desde `/en/` recibe el manifest en inglés, aunque cambie de idioma después. Es una limitación del estándar, aceptada.

### 2. `src/layouts/BaseLayout.astro`

`<link rel="manifest">` apunta a `${base}manifest.en.webmanifest` cuando el locale es `en` y a `${base}manifest.webmanifest` en el resto. Nada más del head cambia (`apple-mobile-web-app-title` sigue "SelfGains").

### 3. `public/sw.js`

- `SHELL` gana `'/SelfGains/en/'` y `'/SelfGains/manifest.en.webmanifest'`.
- `VERSION` pasa de `'selfgains-shell-v1'` a `'selfgains-shell-v2'`; el handler `activate` ya borra las cachés con otro nombre.
- Riesgo: `cache.addAll` es atómico; si una URL del `SHELL` diera 404 fallaría la instalación completa. Se verifica contra `dist/` (ambas URLs deben existir) y con el service worker registrado en un navegador real.

### 4. `.github/workflows/deploy.yml`

Un paso `- run: npm test` entre `npm ci` y `npm run build` del job `build`. Node 22 ya ejecuta los `.ts` sin más (ver `tests/`). Si un test falla no se despliega.

### 5. Errata

Solo la palabra en el cuerpo en español de `natacion-crol-fingertip-drag.md`. `instructions_en` no cambia.

## Pruebas

- `npm test` (28), `npx tsc --noEmit` (solo el error preexistente de `ProgressList.tsx`), `npm run build` (26 páginas).
- Sobre `dist/`: ambos manifests son JSON válido y comparten `id`; `dist/en/**/index.html` enlaza `manifest.en.webmanifest` y el resto de páginas `manifest.webmanifest`; `dist/manifest.en.webmanifest` y `dist/en/index.html` existen.
- Con Playwright y `astro preview`: el service worker se registra y activa; la caché `selfgains-shell-v2` contiene `/SelfGains/en/` y el manifest en inglés; la caché `selfgains-shell-v1` ya no existe (se simula un cliente con la caché `v1` creada antes de la actualización); el `<link rel="manifest">` de una página `/en/` resuelve al manifest en inglés y el de una en español al de español.
- El CI no se puede probar en local: se valida en el primer push (`gh run watch`) y se corrige si falla.

## Riesgos

- **Instalación atómica del service worker:** ver el punto 3.
- **Identidad de la PWA instalada:** ver el punto 1 (`id` explícito).
- **Cache-busting del service worker:** los navegadores vuelven a bajar `sw.js` cuando cambia un byte, así que el cambio de `VERSION` basta; `skipWaiting`/`clients.claim` ya están en el worker.
