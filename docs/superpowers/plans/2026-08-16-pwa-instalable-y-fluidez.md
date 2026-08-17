# PWA instalable + fluidez de navegación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que SelfGains sea instalable como una app real (manifest, íconos, service worker de app-shell, botón de instalar con hint de iOS) y que navegar/interactuar se sienta fluido (transiciones de página con Astro View Transitions, feedback táctil en botones/tarjetas/guardado).

**Architecture:** Todo vive del lado del cliente, sin cambios de schema ni backend nuevo — `public/manifest.webmanifest` + `public/sw.js` (caché de shell, sin datos de usuario) para instalabilidad; un hook compartido `src/lib/pwaInstall.ts` maneja la detección de `beforeinstallprompt`/iOS/ya-instalada una sola vez, consumido por un componente `InstallPrompt` con dos variantes (tarjeta en Perfil, banner dismissible en Registrar); `<ClientRouter />` de Astro habilita navegación sin recarga completa, con un fade corto en `<main>`; el resto de los cambios son clases Tailwind de feedback táctil (`active:scale-*`) en botones y tarjetas ya existentes.

**Tech Stack:** Astro 5 (`astro:transitions`, ya en el stack), React (patrón existente), Tailwind CSS v4, `sharp` (ya en `node_modules`) para redimensionar un ícono, Playwright (via `npx`, ya usado en este proyecto para testing) para renderizar el ícono maskable y para la verificación final.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-16-pwa-instalable-y-fluidez-design.md`.

**Desviación deliberada del spec (verificada empíricamente antes de escribir este plan):** el spec proponía `transition:persist` en `<Nav />` para que el header/barra inferior no se recarguen entre páginas. Se armó un spike real (Astro dev + Playwright, navegando entre Ejercicios/Progreso/Rutinas) que confirmó que `transition:persist` en el Nav deja el link activo **desactualizado** después de navegar (el resaltado del ítem del nav no se recalcula porque la clase activa se computa server-side por ruta, y `transition:persist` congela ese DOM tal como estaba en la primera carga). Sin `transition:persist`, Astro ya evita la recarga completa de página (sigue siendo navegación client-side vía `ClientRouter`) y el resaltado se actualiza correctamente — se verificó ambos casos con un script de Playwright real contra el dev server. Este plan por lo tanto **no** persiste el Nav; solo agrega `<ClientRouter />` + fade en `<main>`. El resultado visual (sin recarga completa, transición suave) es el mismo que pedía el spec, sin el bug.

---

### Task 1: Íconos nuevos + manifest.webmanifest

**Files:**
- Create: `public/icon-192.png`
- Create: `public/icon-512-maskable.png`
- Create: `public/manifest.webmanifest`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Generar `icon-192.png` redimensionando el ícono existente**

`icon-512.png` ya existe (del trabajo de logo). Para el tamaño estándar de manifest de 192px alcanza con redimensionarlo — es un PNG ya rasterizado, no hace falta re-renderizar la fuente embebida.

Run:
```bash
node -e "require('sharp')('public/icon-512.png').resize(192,192).toFile('public/icon-192.png').then(()=>console.log('done'))"
```
Expected: imprime `done`, se crea `public/icon-192.png`.

- [ ] **Step 2: Verificar el tamaño del archivo generado**

Run: `file public/icon-192.png`
Expected: `public/icon-192.png: PNG image data, 192 x 192, ...`

- [ ] **Step 3: Generar `icon-512-maskable.png` con margen de seguridad**

Android recorta el ícono maskable en un círculo/squircle — `icon-512.png` (el octágono ya casi toca los bordes del canvas) se cortaría mal. Se genera una variante nueva con el mismo mark centrado a menor escala sobre un fondo ink sólido, usando el mismo patrón que ya usó este repo para los íconos existentes (Playwright/Chromium en vez de un rasterizador de línea de comandos, porque `favicon.svg` embebe la fuente Bebas Neue como data-URI y `sharp`/librsvg no la procesan igual que un navegador — ver `docs/agents/logo-identidad-status.md`).

Run:
```bash
mkdir -p /tmp/selfgains-icons
REPO_ROOT="$(pwd)"
cat > /tmp/selfgains-icons/maskable.html <<EOF
<!doctype html>
<html>
<head><style>
  html,body { margin:0; padding:0; }
  body {
    width: 512px; height: 512px;
    background: #0c0c0a;
    display: flex; align-items: center; justify-content: center;
  }
  img { width: 300px; height: 300px; display: block; }
</style></head>
<body>
  <img src="file://${REPO_ROOT}/public/favicon.svg" />
</body>
</html>
EOF
npx --no-install playwright screenshot --viewport-size "512,512" "file:///tmp/selfgains-icons/maskable.html" public/icon-512-maskable.png
rm -rf /tmp/selfgains-icons
```
Expected: se crea `public/icon-512-maskable.png`, 512×512, con el octágono acid centrado dejando ~20% de margen ink alrededor por cada lado (verificado visualmente en el spike de este mismo plan: el mark queda perfectamente centrado con margen amplio, fuente Bebas Neue renderizada correctamente, sin fallback a fuente genérica).

- [ ] **Step 4: Verificar visualmente ambos íconos**

Abrir `public/icon-192.png` y `public/icon-512-maskable.png` con cualquier visor de imágenes (o la herramienta `Read` si se está usando un agente) y confirmar: el octágono acid con "SG" en Bebas Neue se ve nítido en ambos, sin texto cortado ni fuente genérica de fallback, y el maskable tiene margen visible alrededor del octágono (no toca los bordes del canvas).

- [ ] **Step 5: Crear `manifest.webmanifest`**

```json
{
  "name": "SelfGains",
  "short_name": "SelfGains",
  "description": "Registro de entrenamientos, rutinas y progreso — gym, running, natación y combate.",
  "lang": "es",
  "start_url": "/SelfGains/",
  "scope": "/SelfGains/",
  "display": "standalone",
  "background_color": "#0c0c0a",
  "theme_color": "#0c0c0a",
  "icons": [
    { "src": "/SelfGains/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/SelfGains/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/SelfGains/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Los paths son absolutos con el prefijo `/SelfGains/` (el `base` de `astro.config.mjs`) porque este archivo vive en `public/` y Astro lo copia tal cual a `dist/` sin procesar variables — no hay forma de interpolar `import.meta.env.BASE_URL` acá, a diferencia de los archivos `.astro`.

- [ ] **Step 6: Linkear el manifest y agregar meta tags de iOS en `BaseLayout.astro`**

Sin los meta tags `apple-mobile-web-app-*`, iOS Safari agrega la app a la pantalla de inicio como un simple bookmark que sigue abriendo con la barra de Safari — el manifest solo no alcanza para el modo standalone en iOS (Apple no lee `display: standalone` del manifest para esto).

En `src/layouts/BaseLayout.astro`, reemplazar:

```astro
    <link rel="apple-touch-icon" href={`${base}apple-touch-icon.png`} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
```

por:

```astro
    <link rel="apple-touch-icon" href={`${base}apple-touch-icon.png`} />
    <link rel="manifest" href={`${base}manifest.webmanifest`} />
    <meta name="theme-color" content="#0c0c0a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="SelfGains" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: build limpio, sin errores. `dist/manifest.webmanifest`, `dist/icon-192.png` y `dist/icon-512-maskable.png` deben existir (`ls dist/*.webmanifest dist/icon-192.png dist/icon-512-maskable.png`).

- [ ] **Step 8: Commit**

```bash
git add public/icon-192.png public/icon-512-maskable.png public/manifest.webmanifest src/layouts/BaseLayout.astro
git commit -m "feat: add PWA manifest, icons, and iOS standalone meta tags"
```

---

### Task 2: Service worker de app-shell

**Files:**
- Create: `public/sw.js`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Crear `public/sw.js`**

```js
// SelfGains service worker — caché de app-shell únicamente.
// No guarda datos de usuario ni intercepta escrituras a Supabase.
// Ver docs/superpowers/specs/2026-08-16-pwa-instalable-y-fluidez-design.md.
const VERSION = 'selfgains-shell-v1';

const SHELL = ['/SelfGains/', '/SelfGains/favicon.svg', '/SelfGains/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHashedAsset(url) {
  return url.pathname.includes('/_astro/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  if (isHashedAsset(url)) {
    // Cache-first: Vite hashea el nombre de archivo por contenido, es seguro
    // cachearlo indefinidamente.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Network-first para todo lo demás (HTML, manifest, favicons, este mismo
  // sw.js) — siempre preferir la versión más nueva cuando hay conexión, caer
  // al caché del shell solo si falla la red.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

- [ ] **Step 2: Registrar el service worker en `BaseLayout.astro`**

Reemplazar:

```astro
    </script>
  </head>
```

por:

```astro
    </script>
    <script is:inline define:vars={{ swUrl: `${base}sw.js` }}>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register(swUrl).catch(() => {});
        });
      }
    </script>
  </head>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build limpio. `dist/sw.js` debe existir.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js src/layouts/BaseLayout.astro
git commit -m "feat: add app-shell service worker"
```

---

### Task 3: Lógica compartida de instalación (`pwaInstall.ts`)

**Files:**
- Create: `src/lib/pwaInstall.ts`

- [ ] **Step 1: Escribir el hook**

```ts
import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_KEY = 'selfgains-pwa-installed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ en modo "escritorio" se identifica como Mac con soporte táctil.
  const isIPadOSDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOSDesktopMode;
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(INSTALLED_KEY) === 'true' || isStandalone();
    } catch {
      return isStandalone();
    }
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice] = useState(() => isIOS());

  useEffect(() => {
    function onBeforeInstallPrompt(ev: Event) {
      ev.preventDefault();
      setDeferredPrompt(ev as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      try {
        localStorage.setItem(INSTALLED_KEY, 'true');
      } catch {
        // localStorage puede fallar en modo privado — no es crítico acá.
      }
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      try {
        localStorage.setItem(INSTALLED_KEY, 'true');
      } catch {
        // idem arriba.
      }
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  return {
    installed,
    canInstall: deferredPrompt !== null,
    isIOSDevice,
    promptInstall,
  };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios. Nada importa este archivo todavía, así que esto solo confirma que no hay errores de sintaxis/tipos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pwaInstall.ts
git commit -m "feat: add shared PWA install-detection hook"
```

---

### Task 4: Componente `InstallPrompt` + integración en Perfil y Registrar

**Files:**
- Create: `src/components/react/InstallPrompt/InstallPrompt.tsx`
- Modify: `src/pages/perfil.astro`
- Modify: `src/pages/registro/nuevo.astro`

- [ ] **Step 1: Escribir el componente**

```tsx
import { useState } from 'react';
import { usePwaInstall } from '../../../lib/pwaInstall';

const BANNER_DISMISSED_KEY = 'selfgains-pwa-banner-dismissed';

interface Props {
  variant: 'card' | 'banner';
}

export default function InstallPrompt({ variant }: Props) {
  const { installed, canInstall, isIOSDevice, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    if (variant !== 'banner' || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (installed) return null;
  if (variant === 'banner' && dismissed) return null;
  if (!canInstall && !isIOSDevice) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch {
      // localStorage puede fallar en modo privado — el banner solo no
      // persistirá el dismiss entre visitas, no es crítico.
    }
  }

  const action = isIOSDevice ? (
    <p className="font-mono text-sm text-paper">
      Tocá <strong className="text-acid">Compartir</strong> y después{' '}
      <strong className="text-acid">"Agregar a inicio"</strong>.
    </p>
  ) : (
    <button type="button" onClick={promptInstall} className="btn-brutal-sm">
      Instalar app
    </button>
  );

  if (variant === 'card') {
    return (
      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Instalar SelfGains</p>
        {action}
      </div>
    );
  }

  return (
    <div className="reveal mb-6 flex items-center justify-between gap-3 border-2 border-acid bg-surface px-4 py-3">
      {action}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 font-mono text-lg text-paper-dim hover:text-paper"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Integrar en Perfil**

En `src/pages/perfil.astro`, reemplazar:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ProfileForm from '../components/react/Profile/ProfileForm';
---
<BaseLayout title="Perfil">
  <p class="label-brutal mb-3 text-acid">Tu cuenta</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">PERFIL</h1>
  <ProfileForm client:load />
</BaseLayout>
```

por:

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

- [ ] **Step 3: Integrar en Registrar**

En `src/pages/registro/nuevo.astro`, reemplazar:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import { getCollection } from 'astro:content';
```

por:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import InstallPrompt from '../../components/react/InstallPrompt/InstallPrompt';
import { getCollection } from 'astro:content';
```

y reemplazar:

```astro
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <WorkoutLogger client:load activities={activities} plans={plans} />
</BaseLayout>
```

por:

```astro
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <InstallPrompt client:load variant="banner" />
  <WorkoutLogger client:load activities={activities} plans={plans} />
</BaseLayout>
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios, 8 páginas generadas (sin cambio en el conteo — no se agregó ninguna página nueva).

- [ ] **Step 5: Commit**

```bash
git add src/components/react/InstallPrompt/InstallPrompt.tsx src/pages/perfil.astro src/pages/registro/nuevo.astro
git commit -m "feat: add install-app prompt to Perfil and Registrar"
```

---

### Task 5: Transiciones de navegación (Astro View Transitions)

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Importar `ClientRouter` y `fade`**

Reemplazar:

```astro
---
import '../styles/global.css';
import Nav from '../components/astro/Nav.astro';

interface Props {
```

por:

```astro
---
import '../styles/global.css';
import Nav from '../components/astro/Nav.astro';
import { ClientRouter, fade } from 'astro:transitions';

interface Props {
```

- [ ] **Step 2: Agregar `<ClientRouter />` al final de `<head>`**

Reemplazar:

```astro
      }
    </script>
  </head>
```

por:

```astro
      }
    </script>
    <ClientRouter />
  </head>
```

(Este bloque es el cierre del script de registro del service worker agregado en la Task 2 — confirmar que el `<ClientRouter />` queda como último hijo de `<head>`, después de ese script.)

- [ ] **Step 3: Aplicar fade al contenido de `<main>`**

Reemplazar:

```astro
    <Nav />
    <main class="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6 sm:py-14">
      <slot />
    </main>
```

por:

```astro
    <Nav />
    <main transition:animate={fade({ duration: '0.2s' })} class="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6 sm:py-14">
      <slot />
    </main>
```

No se agrega `transition:persist` en `<Nav />` — ver la nota de "Desviación deliberada del spec" al principio de este plan.

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 5: Verificación manual rápida de que la navegación no recarga la página**

```bash
npx astro preview --port 4322 &
sleep 2
```

Abrir `http://localhost:4322/SelfGains/ejercicios/` en un navegador (o repetir el spike de Playwright de este plan: `page.evaluate(() => window.__marker = true)`, click en un link del nav, `page.evaluate(() => window.__marker)` debe seguir devolviendo `true` — una recarga completa lo hubiera reseteado a `undefined`). Confirmar también que el link activo en el nav cambia correctamente al navegar (esto es exactamente lo que falló en el spike con `transition:persist` y por eso no se usa acá).

Detener el preview: `kill %1` (o el PID que haya quedado).

- [ ] **Step 6: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: enable Astro View Transitions with a simple fade"
```

---

### Task 6: Micro-interacciones (feedback táctil)

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/react/ProgressList/PRGrid.tsx`
- Modify: `src/components/react/ProgressList/CardioPRGrid.tsx`
- Modify: `src/components/react/ProgressList/DisciplineSummary.tsx`
- Modify: `src/components/react/ProgressList/MeasurementsSummary.tsx`
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`

- [ ] **Step 1: Agregar `.card-brutal-tap` y feedback de presión a `.btn-brutal-sm` en `global.css`**

Reemplazar:

```css
  .btn-brutal-sm {
    @apply inline-flex items-center justify-center border-2 border-paper bg-surface-raised px-4 py-2
      font-display text-base uppercase tracking-wide text-paper transition-colors duration-150
      hover:bg-acid hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-paper;
  }

  .card-brutal {
    @apply border-2 border-paper-dim/40 bg-surface p-5;
  }
```

por:

```css
  .btn-brutal-sm {
    @apply inline-flex items-center justify-center border-2 border-paper bg-surface-raised px-4 py-2
      font-display text-base uppercase tracking-wide text-paper transition duration-150
      hover:bg-acid hover:text-on-accent active:scale-95
      disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-paper;
  }

  .card-brutal-tap {
    @apply transition-transform duration-100 active:scale-[0.98];
  }

  .card-brutal {
    @apply border-2 border-paper-dim/40 bg-surface p-5;
  }
```

(`.btn-brutal`/`.btn-brutal-outline` ya tienen su propio feedback de presión — el desplazamiento de sombra brutalista — y no se tocan acá.)

- [ ] **Step 2: Agregar `card-brutal-tap` a las tarjetas clickeables**

En `src/components/react/ProgressList/PRGrid.tsx`, reemplazar:

```tsx
                className="card-brutal flex flex-col gap-1 text-left transition-colors hover:border-acid"
```

por:

```tsx
                className="card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid"
```

En `src/components/react/ProgressList/CardioPRGrid.tsx`, reemplazar:

```tsx
                className="card-brutal flex flex-col gap-1 text-left transition-colors hover:border-acid"
```

por:

```tsx
                className="card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid"
```

En `src/components/react/ProgressList/DisciplineSummary.tsx`, reemplazar:

```tsx
            className={`card-brutal flex flex-col gap-1 border-t-4 text-left transition-colors hover:border-acid ${
              selected === s.discipline ? 'border-acid' : ''
            }`}
```

por:

```tsx
            className={`card-brutal card-brutal-tap flex flex-col gap-1 border-t-4 text-left transition-colors hover:border-acid ${
              selected === s.discipline ? 'border-acid' : ''
            }`}
```

En `src/components/react/ProgressList/MeasurementsSummary.tsx`, reemplazar:

```tsx
            className={`card-brutal flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === key ? 'border-acid' : ''
            }`}
```

por:

```tsx
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === key ? 'border-acid' : ''
            }`}
```

- [ ] **Step 3: Feedback táctil en los steppers `+`/`−` de `WorkoutLogger.tsx`**

El botón de restar y el de sumar en `SteppedNumberField` comparten exactamente el mismo `className` — reemplazar las dos ocurrencias:

```tsx
          className="h-14 w-14 shrink-0 border-2 border-paper-dim/50 font-display text-2xl text-paper active:border-acid active:text-acid"
```

por (en ambas ocurrencias):

```tsx
          className="h-14 w-14 shrink-0 border-2 border-paper-dim/50 font-display text-2xl text-paper transition-transform duration-100 active:scale-95 active:border-acid active:text-acid"
```

- [ ] **Step 4: Animación de entrada en el mensaje de guardado**

En `src/components/react/WorkoutLogger/WorkoutLogger.tsx`, reemplazar:

```tsx
      {savedMessage && (
        <p className="border-l-2 border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
      )}
```

por:

```tsx
      {savedMessage && (
        <p key={savedMessage} className="reveal border-l-2 border-acid pl-3 font-mono text-sm text-acid">
          {savedMessage}
        </p>
      )}
```

`key={savedMessage}` es necesario para que React trate cada mensaje nuevo como un nodo distinto — sin la key, al reemplazar un mensaje por otro React reutiliza el mismo `<p>` y la animación `.reveal` (que solo se dispara al montar) no se repite.

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/components/react/ProgressList/PRGrid.tsx src/components/react/ProgressList/CardioPRGrid.tsx src/components/react/ProgressList/DisciplineSummary.tsx src/components/react/ProgressList/MeasurementsSummary.tsx src/components/react/WorkoutLogger/WorkoutLogger.tsx
git commit -m "feat: add tap feedback to buttons, cards, and the saved-set message"
```

---

### Task 7: Verificación manual end-to-end

Sin suite de tests automatizada (consistente con el resto del proyecto). Reusar una cuenta de prueba ya confirmada de una sesión anterior si hay una disponible, o crear una nueva vía `supabase db query --linked` (no vía Admin API con la service-role key en curl crudo — en sesiones de background/auto-mode ese comando queda bloqueado por exponer un secreto en texto plano; ver `docs/agents/notas-de-entorno-y-lecciones.md`).

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios, 8 páginas generadas.

- [ ] **Step 2: Matar procesos de dev/preview huérfanos antes de arrancar**

Run: `ps aux | grep -E "astro dev|astro preview|esbuild" | grep -v grep`
Si aparece algo de una corrida anterior, matarlo con `kill -9 <pid>` antes de seguir (ver nota de entorno sobre procesos zombie en `docs/agents/notas-de-entorno-y-lecciones.md`).

- [ ] **Step 3: Levantar el preview y abrir con Playwright**

```bash
npx astro preview --port 4322 &
sleep 2
```

- [ ] **Step 4: Manifest y service worker se sirven correctamente**

Con Playwright (o `curl`), confirmar:
- `curl -sI http://localhost:4322/SelfGains/manifest.webmanifest` responde `200` con `Content-Type` de JSON/manifest.
- `curl -sI http://localhost:4322/SelfGains/sw.js` responde `200`.
- Abrir cualquier página con Playwright y confirmar en la consola del navegador que no hay errores de registro del service worker (`navigator.serviceWorker.ready` resuelve sin rechazar).

- [ ] **Step 5: Botón de instalar (simulado) en Perfil y banner en Registrar**

`beforeinstallprompt` no se puede disparar realmente en Chromium headless (depende de heurísticas internas del navegador) — se simula el evento para confirmar que la UI reacciona:

```js
await page.goto('http://localhost:4322/SelfGains/perfil/');
await page.evaluate(() => {
  const ev = new Event('beforeinstallprompt');
  Object.assign(ev, {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  });
  window.dispatchEvent(ev);
});
```

Confirmar que aparece el botón "Instalar app" en la tarjeta de Perfil. Repetir en `/registro/nuevo/` y confirmar que aparece el banner arriba del formulario. Click en "Instalar app" en cualquiera de los dos, confirmar que no tira error en consola (el `prompt()`/`userChoice` simulados resuelven bien) y que el botón desaparece después (porque `promptInstall` marca `installed`).

- [ ] **Step 6: Dismiss del banner persiste**

En `/registro/nuevo/`, disparar `beforeinstallprompt` simulado de nuevo (sin recargar antes, para no perder el estado de "instalado" del paso anterior — usar una pestaña nueva de Playwright si hace falta empezar de cero), click en el ✕ del banner, confirmar que desaparece. Recargar la página completa y confirmar que el banner **no** vuelve a aparecer (mismo `localStorage`).

- [ ] **Step 7: Transiciones de navegación**

```js
await page.goto('http://localhost:4322/SelfGains/ejercicios/');
await page.evaluate(() => { window.__marker = true; });
await page.click('header a:text-is("Progreso")');
await page.waitForTimeout(500);
console.log(await page.evaluate(() => window.__marker)); // debe seguir siendo true
console.log(page.url()); // debe terminar en /progreso/
```

Confirmar además que el link "Progreso" queda resaltado (clase con `bg-acid`) y "Ejercicios" ya no. Repetir navegando a otra sección más para confirmar que no es un caso aislado.

- [ ] **Step 8: `prefers-reduced-motion` no rompe nada**

```js
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto('http://localhost:4322/SelfGains/ejercicios/');
await page.click('header a:text-is("Rutinas")');
```

Confirmar que la navegación sigue funcionando (URL cambia a `/rutinas/`) sin errores de consola.

- [ ] **Step 9: El explorador muscular 3D sobrevive a navegar afuera y volver**

```js
await page.goto('http://localhost:4322/SelfGains/ejercicios/');
await page.waitForTimeout(1000); // deja que la escena de Three.js monte
await page.click('header a:text-is("Progreso")');
await page.waitForTimeout(500);
await page.click('header a:text-is("Ejercicios")');
await page.waitForTimeout(1000);
```

Confirmar que no hay errores de consola (más allá del log esperado `THREE.WebGLRenderer: Context Lost` al desmontar, que es parte normal del cleanup) y que el canvas 3D vuelve a verse al regresar a `/ejercicios/`.

- [ ] **Step 10: Feedback táctil visual**

Con un viewport angosto (ej. 390×844, simulando mobile), ir a `/progreso/`, mantener presionado el mouse sobre una tarjeta de PR o de resumen por disciplina y confirmar visualmente (captura de pantalla) que se achica levemente. En `/registro/nuevo/`, mantener presionado un botón `+`/`−` de un campo de cardio y confirmar el mismo efecto.

- [ ] **Step 11: Limpieza**

```bash
kill %1
ps aux | grep -E "astro preview|esbuild" | grep -v grep
```
Matar cualquier proceso que haya quedado colgado.
