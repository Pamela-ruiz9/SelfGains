# Logo / identidad visual — estado

Pedido: "trabajemos en un logo para la app". Se resolvió con 3 rondas de exploración visual (mostradas como Artifacts, no como código) hasta converger, y una implementación final como favicon + ícono de app + marca junto al wordmark del nav. Sin spec/plan formal en `docs/superpowers/` — proceso puramente iterativo con feedback directo del usuario en cada ronda.

## Proceso de exploración (2026-08-16)

Antes de proponer nada se preguntó explícitamente (vía `AskUserQuestion`, no asumido): ¿ícono solo o ícono + wordmark? → **ícono + wordmark**. ¿Qué dirección visual? → **monograma geométrico** (de tres opciones: monograma, basado en mancuerna, abstracto tipo barra de progreso).

Cada ronda se construyó como una página HTML (Artifact) con los tokens de color/tipografía reales de la app (`--color-ink #0c0c0a`, `--color-acid #d7ff3f`, Bebas Neue + JetBrains Mono embebidas como data-URI) en vez de un estilo genérico — mostrando cada concepto a escala de favicon real (16px), ícono de app, y junto al wordmark, con una sección final simulando la pestaña del navegador para la prueba de legibilidad real.

**Ronda 1** — 3 conceptos: *Readout* (S de 5 barras rectas, como dígito de contador), *Bolt* (S doblada en rayo), *Bracket* ("SG" tipografiado en un marco con esquinas cortadas). Feedback: "quiza me gusta mas la bracket pero ninguna en realidad" → se le preguntó qué específicamente no convencía → "se siente muy genérico en general", pero **seguir afinando el marco**, no abandonar la idea.

**Ronda 2** — mismo marco de esquinas cortadas, 3 símbolos interiores nuevos que no fueran letras genéricas: *Breakout* (barras ascendentes que perforan el marco, mismo lenguaje que la barra de progreso de la app), *Plates* (disco de pesas de canto), *Fractured* (sin símbolo literal, el marco lleva la sombra plana desplazada que ya usan los botones de la app). Feedback: "otro" (sin detalle) → se preguntó cuál iba mejor encaminado → **Breakout**, y **sacar el marco** (probar el símbolo solo, sin insignia).

**Ronda 3** — Breakout sin marco, fundido en una sola silueta (antes eran 3 rectángulos separados con huecos, ahora una escalera continua que termina en punta) para que no se leyera como el ícono de Progreso del nav (que sí son barras separadas). Se había planeado una segunda variante (*Spike*, una punta atravesando una línea partida) pero **se descartó antes de mostrarla** — al armarla y mirarla se leía como una cruz/crucifijo, no como progreso, mal look para la app. Se documentó la decisión en la misma página en vez de simplemente omitirla sin explicar. Feedback final (textual, con errores de tipeo del usuario): "no me gusta nasa, quedemonos por shora con el sg" → **se volvió a la Ronda 1 (Bracket/SG)** como decisión "por ahora", no a Breakout.

## Implementación final (2026-08-16)

El usuario decidió quedarse con el concepto de la Ronda 1 (SG en marco de esquinas cortadas), no con Breakout de la Ronda 3 — aunque Breakout había recibido mejor feedback en el camino, la decisión final fue explícitamente volver al primero.

- `public/favicon.svg` — el mark SG: octágono (cuadrado con las 4 esquinas cortadas) relleno de acid `#d7ff3f`, texto "SG" en Bebas Neue, relleno ink `#0c0c0a`.
- `public/favicon-32.png`, `public/apple-touch-icon.png` (180px), `public/icon-512.png` — generados a partir del mismo SVG.
- El mark se agregó junto al wordmark "SELF GAINS" en `Nav.astro` (versión outline: sin relleno, solo trazo + texto en acid, para que se vea bien sobre el fondo oscuro del header sin necesitar su propio chip de fondo).

**Detalle técnico importante — por qué el favicon.svg embebe la fuente:** `favicon.svg` se sirve directo por el navegador como ícono de pestaña, sin pasar por Astro/Vite — si el SVG solo referencia `font-family: "Bebas Neue"` por nombre, el navegador no tiene forma de cargar esa fuente (no hay `<link>` de Google Fonts en el contexto de un favicon) y cae a un sans-serif genérico, perdiendo el look condensado de la marca. Se resolvió embebiendo el woff2 de Bebas Neue como data-URI dentro de un `<style>@font-face{...}</style>` **dentro del propio SVG** — los navegadores modernos sí procesan `@font-face` embebido en un SVG usado como favicon.

**Por qué los PNG se generaron con Chromium real (Playwright) y no con un rasterizador tipo `sharp`/librsvg:** el primer intento usó `sharp` (ya estaba en `node_modules` como dependencia transitiva) para rasterizar el SVG a PNG — el resultado tenía el fallback de fuente genérico, no Bebas Neue, porque el motor de renderizado de `sharp` (librsvg) no procesa `@font-face` con data-URI de la misma forma que un navegador. Se resolvió envolviendo el mismo SVG en un HTML mínimo y usando Playwright/Chromium (ya usado para testing en este proyecto) para renderizarlo a resolución real y hacer `screenshot()` — mismo resultado visual exacto que verá cualquier usuario real, sin depender de que el rasterizador soporte data-URI fonts.

**Fondos por tipo de ícono:**
- `favicon.svg`/`favicon-32.png`: fondo transparente fuera del octágono (los navegadores lo manejan bien).
- `apple-touch-icon.png`/`icon-512.png`: fondo ink sólido (`#0c0c0a`), no transparente — Apple explícitamente no recomienda transparencia en apple-touch-icon (lo compone sobre negro o blanco de forma impredecible), así que se le dio un fondo intencional en vez de dejarlo transparente.

Commit: `1d84df2`.

## Verificación hecha

- Cada ronda de exploración se auto-revisó con captura de pantalla (Playwright + `file://`) antes de publicarse como Artifact — esto encontró y corrigió 3 problemas reales antes de que el usuario los viera: un bug de CSS (`display:flex` en un `<p>` fragmentaba el texto en items independientes que envolvían mal), un badge de ícono de app con el símbolo invisible (mismo color que el fondo), y la variante "Spike" que se veía como una cruz.
- La implementación final (favicon/apple-touch-icon/icon-512/mark en el nav) se verificó con `npm run build` + `tsc --noEmit` limpios, confirmación de que `public/*` se copia a `dist/` con las URLs de `<link>` correctas (con el prefijo `/SelfGains/` del `base` de Astro), y una captura de pantalla del header real en `npm run dev` confirmando que el mark se ve bien junto al wordmark.

## Lo que falta / limitaciones conocidas

- La decisión es explícitamente "por ahora" ("quedemonos por shora con el sg") — el usuario puede querer retomar la exploración de Breakout u otra dirección más adelante.
- Sin manifest.webmanifest / meta tags de PWA (`theme-color`, `apple-mobile-web-app-*`) — el ícono de 512px existe pero no está conectado a nada que lo consuma todavía.
- El mark en el nav (versión outline) y el favicon (versión rellena) son dos SVG separados a mano, no un solo source con variantes — si el color de acento cambia, el favicon queda fijo en el acid por defecto (no sigue el acento personalizable del usuario, cosa que sí sería posible pero no se implementó).

## Si se retoma

- Las 3 páginas de exploración (Ronda 1/2/3) quedaron publicadas como Artifacts privados del usuario, no en el repo — si se quiere retomar la ronda de Breakout, hay que pedirle el link o volver a construir la variante desde la descripción de este documento (la geometría exacta de Breakout está en el historial de conversación, no en ningún archivo del repo).
- Antes de generar íconos nuevos a partir de un SVG con fuente embebida, usar el mismo patrón (Playwright + HTML wrapper) en vez de `sharp`/librsvg directo — ver la nota técnica arriba.