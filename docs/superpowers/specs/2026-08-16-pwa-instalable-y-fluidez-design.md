# PWA instalable + fluidez de navegación — diseño

Pedido original: la app "se sigue viendo no tan app sino más estática" y se instala hoy como un simple acceso directo al navegador, no como una app real. Este spec cubre hacerla instalable de verdad (manifest, ícono, splash, botón de instalación) y más fluida al navegar/interactuar (transiciones de página, feedback táctil).

**Explícitamente fuera de esta ronda:** logueo de entrenamientos sin conexión y sincronización posterior con Supabase al reconectar. Es un subsistema grande aparte (cola de escritura local, manejo de conflictos, UI de "pendiente de sincronizar") que se diseñará como spec 2, construido sobre el service worker que este spec deja instalado. Tampoco cubre nada del backlog de negocio (roles de entrenador, perfil enriquecido, compartir rutinas, buscador de entrenadores) — ver `docs/roadmap-ideas.md`.

## Referencia usada

Se investigó el repo [rastrum](https://github.com/ArtemioPadilla/rastrum) (Artemio Padilla, también Astro estático) como ejemplo de PWA real: estructura de `manifest.webmanifest` (iconos `maskable`, `display: standalone`, `theme_color`), `sw.js` con estrategia de caché app-shell (HTML network-first, assets hasheados cache-first), y un componente de botón de instalación que maneja `beforeinstallprompt` en Android más un hint aparte para iOS (que no dispara ese evento). Los patrones de este spec siguen ese mismo enfoque, adaptados al tema visual y componentes de SelfGains.

## Enfoque técnico elegido

**Astro View Transitions nativo (`<ClientRouter />`)**, ya soportado por Astro 5 (versión ya en el stack) sin dependencias nuevas. Se descartaron dos alternativas: migrar a routing 100% client-side (SPA) — reescritura grande que tira la arquitectura actual de páginas Astro independientes, muy por encima de lo que pide el problema — y transiciones manuales con JS/fetch — reinventa la View Transitions API nativa con peor soporte de accesibilidad (`prefers-reduced-motion`, atrás/adelante del navegador).

## 1. Manifest + íconos

`public/manifest.webmanifest` nuevo:

- `name`: "SelfGains", `short_name`: "SelfGains".
- `start_url` / `scope`: `/SelfGains/` (respeta el `base` configurado en `astro.config.mjs`, mismo patrón que ya usa `BaseLayout.astro` vía `import.meta.env.BASE_URL`).
- `display: "standalone"` — se abre sin barra de direcciones del navegador.
- `background_color: "#0c0c0a"` (ink) — color de splash mientras carga, coincide con el fondo ya usado en el favicon.
- `theme_color: "#0c0c0a"` (ink) — color de la barra de estado del sistema, coincide con el header oscuro del nav.
- Íconos: reusa `icon-512.png` (ya existe). Se agrega:
  - `icon-192.png` (falta hoy, tamaño estándar de manifest).
  - Una variante con padding/margen de seguridad marcada `purpose: "maskable"` — Android recorta el ícono en un círculo/squircle; sin margen, el logo queda cortado. `icon-512.png`/`icon-192.png` existentes quedan como `purpose: "any"`.
- Se linkea desde `BaseLayout.astro`: `<link rel="manifest" href={`${base}manifest.webmanifest`} />`, junto a los `<link rel="icon">`/`apple-touch-icon` ya existentes.

## 2. Service worker (app-shell, sin datos de usuario)

`public/sw.js` nuevo, minimalista:

- Estrategia de caché:
  - HTML: **network-first** (para no servir una versión vieja de la app cuando hay conexión — cae a caché solo si falla la red).
  - JS/CSS con hash de Vite (`/SelfGains/_astro/...`): **cache-first** (inmutables por URL, seguro cachearlos indefinidamente).
  - `manifest.webmanifest`, favicons, `sw.js` mismo: **network-first**.
- `install`: precachea el app-shell (rutas base + assets críticos).
- `activate`: `self.skipWaiting()` + `clients.claim()`, borra cachés de versiones anteriores — para que una actualización de la app se aplique rápido sin dejar al usuario pegado en una versión vieja.
- **Sin IndexedDB ni cola de escritura** — no guarda ni intercepta escrituras a Supabase. Eso es el spec 2.
- Se registra con un `<script>` chico `is:inline` en `BaseLayout.astro`: `if ('serviceWorker' in navigator) navigator.serviceWorker.register(...)`, con la URL construida respetando `base`.

## 3. Botón de instalación

Lógica compartida en `src/lib/pwaInstall.ts` (evita duplicar el listener en dos componentes):

- Escucha `beforeinstallprompt`, hace `preventDefault()` y guarda el evento para dispararlo manualmente al tocar el botón propio.
- Expone un chequeo de "ya instalada": `display-mode: standalone` vía media query, o flag en `localStorage` (`selfgains-pwa-installed`) seteado en el evento `appinstalled`.
- Expone un chequeo de iOS (`navigator.userAgent` / `navigator.maxTouchPoints` para iPadOS) para decidir qué UI mostrar, ya que iOS no dispara `beforeinstallprompt`.

Dos superficies UI, ambas consumiendo el mismo módulo:

- **Tarjeta en `/perfil/`**: junto a tema/acento/logout (ya establecido como el lugar de "ajustes" de la app). En Android/Chrome muestra "Instalar SelfGains" (`btn-brutal`) que dispara el prompt guardado. En iOS muestra instrucciones fijas ("Tocá Compartir → Agregar a inicio") con el ícono de compartir de iOS. Se oculta por completo si ya está instalada. Siempre visible mientras no esté instalada (no se puede dismissear desde acá — es una sección de ajustes, no un banner intrusivo).
- **Banner en `/registrar/`** (la pantalla más usada): franja angosta arriba del contenido, mismo texto/lógica que la tarjeta de Perfil, con botón de cerrar (✕). El dismiss persiste en `localStorage` (`selfgains-pwa-banner-dismissed`) — no vuelve a aparecer una vez cerrado. Se oculta también si ya está instalada, independientemente del dismiss.

## 4. Transiciones de navegación

- `<ClientRouter />` de Astro agregado en `BaseLayout.astro`.
- `transition:persist` en `<Nav />` (header + barra inferior) — no recargan ni parpadean entre páginas, solo el `<main>` central hace la transición.
- Fade simple: se pisa la animación default de Astro con CSS propio sobre `::view-transition-old(root)` / `::view-transition-new(root)` (opacidad, sin slide/scale, ~150–200ms).
- Respeta `prefers-reduced-motion: reduce` — sin animación para quien lo tenga activado a nivel sistema.

## 5. Micro-interacciones (feedback táctil)

- Estado de "presionado" (`active:scale-95` + transición corta) en botones `btn-brutal`/`btn-brutal-outline`, steppers `+`/`−` de `SessionFields`, y tarjetas clickeables (PRs, rutinas, resumen por disciplina) — feedback instantáneo al toque, sin esperar la respuesta del servidor.
- El mensaje de guardado (ej. "¡Nuevo PR en X!" en `WorkoutLogger`, ver `buildSavedMessage`) pasa de aparecer/desaparecer de golpe a un fade+slide corto de entrada/salida.
- Sin skeletons/spinners nuevos en esta ronda — el alcance es feedback de interacción, no estados de carga.

## Verificación

Sin suite de tests automatizada (consistente con el resto del proyecto — ver `docs/agents/notas-de-entorno-y-lecciones.md`), verificación manual:

- `npm run build` + `npx tsc --noEmit` limpios.
- Smoke test con Playwright/Chromium:
  - Manifest se sirve con las URLs correctas bajo `/SelfGains/`.
  - Service worker se registra sin error de consola.
  - Botón de instalar aparece en Perfil y el banner en Registrar (simulando `beforeinstallprompt`); dismiss del banner persiste tras recargar.
  - Navegar entre secciones no dispara una recarga completa (nav persiste visualmente, `transition:persist` funciona).
  - `prefers-reduced-motion` desactiva la animación de transición.
- Verificación visual manual: simular `display: standalone` en devtools para confirmar que se ve sin barra de navegador, con ícono/splash correctos.
- **Limitación conocida:** iOS/Safari real no es testeable con Playwright headless en este entorno (no hay motor WebKit/iOS disponible) — la UI del hint de iOS se revisa por lectura de código y captura de Playwright con user-agent simulado, no en un dispositivo real. Igual que otras partes del proyecto, queda pendiente de revisión manual en dispositivo si se quiere confirmar 100%.

## Fuera de alcance (explícito)

- Logueo offline y sincronización (spec 2, después — construido sobre este mismo service worker).
- Push notifications.
- Skeletons/loading states para fetch de datos.
- Splash screen animado más allá del `background_color` estándar del manifest.
- Cualquier ítem del backlog de negocio en `docs/roadmap-ideas.md` (roles de entrenador, perfil enriquecido, compartir rutinas, buscador de entrenadores con mapa, rutinas genéricas nuevas).

## Si se retoma

- El spec 2 (offline + sync) debería reusar `public/sw.js` de este spec como base, agregando un `IndexedDB` con cola de escrituras pendientes y un listener de `online`/`sync` para drenarla contra Supabase.
- Si se agrega un ícono maskable propio (en vez de solo agregar padding al existente), revisar la nota de `docs/agents/logo-identidad-status.md` sobre por qué los PNG se generaron con Playwright/Chromium y no con `sharp`/librsvg (rasterizadores de línea de comandos no procesan `@font-face` con data-URI igual que un navegador real).
