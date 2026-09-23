# Modernización visual de la UI — "brutal-glass" — diseño

Pedido directo de Pam: "modernizar la UI, que se vea más renovada, moderna, limpia, sin cambiar estructura y formas". Es un cambio puramente de capa visual — no toca layout, componentes, formularios, copy ni lógica.

## Contexto: el sistema actual

`src/styles/global.css` define un sistema neo-brutalista: bordes de 2px sólidos, sombras "offset" duras (`Npx Npx 0 0 color`, sin blur), tipografía Bebas Neue en mayúsculas para títulos, JetBrains Mono para labels, acento verde ácido (`--color-acid`) y naranja sangre (`--color-blood`) sobre fondo oscuro con textura de ruido SVG. Cuatro clases compartidas (`.btn-brutal`, `.btn-brutal-outline`, `.btn-brutal-sm`, `.card-brutal`, `.input-brutal`, `.label-brutal`) cubren 41 de 44 archivos que usan este lenguaje visual — solo `Nav.astro`, `Avatar.tsx` y `MapPicker.tsx` reimplementan estilos sueltos en vez de usar las clases compartidas.

Esta centralización es la razón por la que el cambio es viable en una sola pasada coordinada: tocando `global.css` + esas 3 excepciones puntuales, el resto de la app se re-skinnea solo.

## Dirección elegida: "brutal-glass"

Explorada y aprobada con mockups reales (nav + tarjeta + botón) durante el brainstorm. Se probaron 3 direcciones (brutalista pulido / moderno suave genérico / oscuro premium con vidrio) y una combinación de las dos últimas quedó como la elegida: **mantiene la identidad tipográfica y de color de la marca, cambia la geometría** — de bordes duros y sombra offset a esquinas redondeadas, vidrio translúcido con blur, y sombras con glow.

Qué se mantiene sin cambios: paleta de colores (`ink/surface/paper/paper-dim/acid/blood/on-accent`), Bebas Neue para títulos, Archivo para body, JetBrains Mono para labels/mono, el gradiente radial de acento de fondo.

Qué cambia: forma de bordes/esquinas, tratamiento de sombra, textura de fondo.

## 1. Tokens nuevos/modificados (`src/styles/global.css`)

- **Radio**: dos tokens nuevos — `--radius-card: 16px` (tarjetas, contenedores), `--radius-control: 10px` (botones, inputs, pills de nav activo). Los elementos ya circulares (badge de entrenador en `Avatar.tsx`, CTA de "Registrar" en Nav) no necesitan un tercer token — siguen usando `rounded-full`, que ya da el mismo resultado.
- **Bordes**: pasan de `border-2` sólido a `border` de 1px con color semitransparente (`rgb(var(--color-paper) / 0.10)` a `0.12` según contraste necesario) — el borde deja de ser el elemento que define la forma; ahora lo hacen el radio + el fondo translúcido.
- **Sombras**: se elimina el patrón `shadow-[Npx_Npx_0_0_var(--color-paper)]` (offset duro, sin blur) de todos los usos, sin excepción — incluido el botón circular grande de "Registrar" en la barra inferior. Se reemplaza por sombras con blur:
  - Elementos con acento (botones primarios, nav activo): `0 6px 20px rgb(var(--color-acid) / 0.25)` a `0.35` según tamaño.
  - Tarjetas/contenedores neutros en oscuro: glow ambiental tenue, no una sombra de contacto tradicional (ver §2).
  - Tarjetas neutras en claro: `0 4px 16px rgb(0 0 0 / 0.08)`, sin blur de fondo (ver §3).
- **Fondo**: se elimina el `data:image/svg+xml` de ruido/turbulence de `body` en `global.css`. Los dos `radial-gradient` de acento (`acid` al 15%/-10%, `blood` al 100%/0%) se mantienen igual en ambos temas — son el único elemento de textura de fondo que queda.
- **Tipografía**: sin cambios de familia, tamaño ni tracking en ningún nivel.

## 2. Componentes compartidos — tratamiento por clase

- **`.card-brutal`**: `border-2 border-paper-dim/40` → `border border-paper/10 rounded-[--radius-card]`; `bg-surface` → `bg-paper/5` (translúcido) + `backdrop-blur-md`; se agrega la sombra glow tenue de §1. Aplica en modo oscuro; en claro usa la variante sólida de §3.
- **`.btn-brutal`**: esquinas a `--radius-control`; `shadow-[5px_5px_0_0_var(--color-paper)]` (y su variante `:hover`/`:active`) se reemplaza por el glow con tinte acid de §1, sin blur de fondo (es un botón sólido, no necesita `backdrop-blur`). El `hover:-translate-x-0.5 hover:-translate-y-0.5` y el `active:scale`/reset se mantienen — es la micro-interacción, no la forma.
- **`.btn-brutal-outline`**: mismo tratamiento de radio; borde 2px sólido → 1px translúcido; su sombra offset (con acento en vez de paper) se reemplaza igual por glow.
- **`.btn-brutal-sm`**: mismo radio; borde 2px → 1px; no tenía sombra offset propia (ya era plano), sin cambios ahí.
- **`.input-brutal`**: borde 2px → 1px; radio a `--radius-control`; sin cambios de comportamiento, focus state (`focus:border-acid`) se mantiene idéntico.
- **`.label-brutal`**: sin cambios — es solo tipografía mono, no tiene borde/sombra/forma.

## 3. Tema claro (`:root[data-theme="light"]`)

El efecto vidrio (fondo translúcido + `backdrop-blur`) se abandona en modo claro — el mismo truco sobre fondo claro se ve lavado/bajo contraste, confirmado con mockup comparativo durante el brainstorm. En su lugar: tarjetas con fondo sólido opaco (`bg-white` o el token `paper` invertido correspondiente) y la sombra sin blur de fondo descrita en §1. Mismo radio, misma tipografía, misma estructura que en oscuro — la única diferencia es "vidrio translúcido" (oscuro) vs. "sólido opaco con sombra suave" (claro). Esto requiere una regla `:root[data-theme="light"] .card-brutal` específica que pisa el `bg-paper/5 backdrop-blur-md` del modo oscuro.

## 4. Excepciones puntuales (no usan las clases compartidas)

- **`Nav.astro`**: `border-b-2 border-paper` del header → `border-b border-paper/10`; los links activos (`border-acid bg-acid`) y el botón circular de "Registrar" en la nav inferior pasan de bordes 2px sólidos a radio + glow, mismo criterio que `.btn-brutal`.
- **`Avatar.tsx`**: ya es circular (`rounded-full`) — sin cambio de forma. El borde `border-2 border-paper-dim/40` pasa a 1px translúcido para consistencia con el resto del sistema.
- **`MapPicker.tsx`**: el contenedor del mapa (`border-2 border-paper-dim/40`) se ajusta a 1px + `rounded-card`, sin tocar la lógica de posicionamiento/drag del mapa.
- **`CollapsibleSection.tsx`**: su estado cerrado replica a mano el estilo de `.btn-brutal-sm` (el propio comentario del archivo lo dice) — recibe el mismo tratamiento de borde/radio que esa clase.

**Nota (agregada durante la planificación de implementación):** un relevamiento más exhaustivo del código, hecho al escribir el plan, encontró que el patrón `border-2`/`border-b-2`/`border-t-2`/`border-l-2`/`border-t-4` hardcodeado aparece en ~25 archivos más además de los listados arriba (mensajes de error con acento de color, botones chicos de acción que replican `.btn-brutal-sm` a mano, contenedores tipo tarjeta, divisores de secciones). El principio de este documento ("el borde deja de ser el elemento que define la forma", 2px → 1px en todos lados) se aplica igual de forma mecánica a todos ellos; el detalle línea por línea de cada archivo vive en `docs/superpowers/plans/2026-09-22-modernizacion-ui-brutal-glass.md` en vez de repetirse acá.

## 5. Qué NO cambia (explícitamente fuera de esta ronda)

- Estructura de páginas, orden y jerarquía de componentes, layout responsive (grid/flex existentes).
- Formularios: campos, validaciones, mensajes de error, flujos (login, registro, crear rutina, registrar entrenamiento, etc.).
- Navegación: rutas, links, comportamiento del bottom nav en mobile.
- Copy en español — ningún texto cambia.
- Lógica de negocio, llamadas a Supabase, RLS, nada de `src/lib/`.
- Paleta de colores base (ink/surface/paper/blood) y tipografía (familias, tamaños, tracking). El acento (`acid`) sí cambia — ver §6, agregada durante la ejecución.
- El toggle de tema claro/oscuro y la preferencia de unidad de peso — sin cambios de comportamiento, solo su apariencia sigue las reglas de arriba.

## 6. Acento con degradado personalizable (agregado durante la ejecución, no estaba en el pedido original)

Pedido de Pam mid-flight: "que cada acento tenga degradado", con 3 opciones de paleta curadas por mí a partir de mockups en el brainstorm, F3 predeterminado, y que convivan con el selector de color sólido libre que ya existía en Perfil (confirmado explícitamente: no lo reemplazan).

**Los 3 presets** (elegidos con mockups reales — nav + tarjeta + botón — durante el brainstorm):
- **F1** — azul a morado (`#4f9dfe` → `#9b5cf6`), representativo sólido `#8fb4fb`.
- **F2** — morado a magenta (`#8b5cf6` → `#ec4899`), representativo sólido `#c98cf0`, texto claro sobre el relleno (es el único que lo necesita para contraste).
- **F3** (default) — cian a azul (`#22d3ee` → `#3b82f6`), representativo sólido `#67d8f0`.

**Por qué un color "representativo sólido" además del degradado:** un `linear-gradient()` solo se puede pintar en `background-image` — no existe en CSS una forma de aplicar un degradado a `color` (texto) o `border-color`. Por eso cada preset define dos valores: el degradado real (para rellenos: botones, badges, nav activo, barra de progreso) y un color sólido representativo (para todo lo que hoy usa `text-acid`/`border-acid`, que sigue funcionando exactamente igual sin tocar esos archivos).

**Mecanismo técnico:** dos variables CSS controladas por `theme.ts`/`BaseLayout.astro`, igual que ya se hacía con `--color-acid` (inline style en `documentElement`, cacheado en `localStorage`, mas la fuente de verdad real es `profiles.accent_color` en Supabase):
- `--color-acid` — el sólido representativo (o el hex libre elegido, sin cambios respecto a antes).
- `--gradient-acid` — el `linear-gradient()` del preset, o `"none"` en modo color sólido.
- `--color-on-accent` — antes fijo, ahora varía por preset (F2 necesita texto claro).

Dos clases compartidas nuevas en `global.css` (`.pill-selected` para "seleccionado, con borde"; `.fill-acid-on` para "relleno con texto, sin borde propio") capturan el patrón `border-acid bg-acid text-on-accent` que aparecía repetido a mano en ~27 lugares de la app (toggles de tema, unidad de peso, sexo, nivel; filtros de radio/disciplina; radios de rutina compartida) — con las clases compartidas, ese relleno muestra el degradado automáticamente en todos esos lugares sin un cambio por archivo.

Los glows con blur de §1/§2 (botones, tarjetas, Nav) pasan de un `rgba()` fijo con el verde ácido original a `color-mix(in srgb, var(--color-acid) N%, transparent)` — así el glow sigue al acento elegido, sea uno de los 3 presets o cualquier color libre.

**Explícitamente fuera de esta ronda:** el favicon (`public/favicon.svg`) y el color activo del explorador muscular 3D (`MuscleBody.tsx`'s `COLOR_ACTIVE`, un material de Three.js) quedan con el verde ácido original fijo — son casos que no leen `--color-acid` en runtime hoy, y engancharlos es trabajo aparte no pedido.

**Detalle línea por línea:** `docs/superpowers/plans/2026-09-22-modernizacion-ui-brutal-glass.md`, Task 2 (fundación), Task 2b (`theme.ts`/`BaseLayout.astro`/schema), Task 9 (UI de Perfil), y los steps agregados a Tasks 3/4/6/7/8b/10.

## Verificación

Sin suite automatizada, por convención del proyecto. `npm run build && npx tsc --noEmit` limpios (ignorando el error preexistente ya documentado en `ProgressList.tsx`, no relacionado). Recorrido visual con Playwright por las pantallas clave — Nav (mobile y desktop), Rutinas, Registrar, Progreso, Perfil, login/registro/recuperar contraseña — en ambos temas claro y oscuro, confirmando visualmente que: no quedan sombras offset duras ni bordes de 2px en ningún lugar, el modo oscuro muestra el efecto vidrio en tarjetas, el modo claro usa tarjetas sólidas sin blur, y ningún flujo funcional (login, crear rutina, registrar set, editar perfil) se rompió. Además, en Perfil: los 3 presets de degradado y el selector de color libre conviven sin pisarse, el relleno de los toggles/botones de toda la app sigue al preset elegido, F2 muestra texto claro (los otros dos oscuro), y el acento elegido persiste tanto localmente (recarga de página) como en Supabase (cerrar sesión y volver a entrar).
