# Modernización visual "brutal-glass" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskinnear toda la UI de SelfGains a la dirección "brutal-glass" aprobada en `docs/superpowers/specs/2026-09-22-modernizacion-ui-brutal-glass-design.md` — esquinas redondeadas, vidrio translúcido con blur en oscuro, sólido sin blur en claro, sombras con glow en vez de offset duro, sin textura de ruido — sin tocar estructura, formularios, copy ni lógica.

**Architecture:** El 90% del área visual se resuelve editando 5 clases compartidas en `src/styles/global.css` (`.btn-brutal`, `.btn-brutal-outline`, `.btn-brutal-sm`, `.card-brutal`, `.input-brutal`) más dos tokens de radio nuevos en `@theme`. El resto son ~55 usos sueltos de `border-2`/`border-b-2`/`border-t-2`/`border-l-2`/`border-t-4` repartidos en 29 archivos que no pasan por esas clases — cada uno se corrige a mano con el mismo criterio mecánico: se quita el sufijo de ancho (queda el `border`/`border-t`/`border-b`/`border-l` default de 1px de Tailwind) y, únicamente en los que son cajas/botones (no líneas divisorias ni indicadores de 1 lado), se agrega `rounded-control` o `rounded-card`. Nunca se toca el color/opacidad de un borde existente, ni hover/active/disabled, ni ninguna lógica.

**Acento con degradado (agregado durante la ejecución, pedido de Pam):** el acento de marca pasa de verde ácido liso a 3 presets de degradado curados con mockups (F1 azul→morado, F2 morado→magenta, F3 cian→azul — default nuevo), que **conviven** con el selector de color sólido libre que ya existía en Perfil. Técnicamente son dos variables CSS nuevas que `theme.ts`/`BaseLayout.astro` aplican juntas: `--color-acid` (sigue siendo un color sólido — texto/bordes no pueden llevar degradado) y `--gradient-acid` (un `background-image`, `none` en modo color sólido). Dos clases compartidas nuevas en `global.css` (`.pill-selected`, `.fill-acid-on`) reemplazan el patrón repetido a mano `border-acid bg-acid text-on-accent` que aparecía suelto en ~27 lugares de la app (toggles de tema/unidad/sexo/nivel, filtros, radios de rutina) — con esas dos clases, el relleno de todos esos toggles automáticamente muestra el degradado activo sin tocar cada uno por separado en el futuro. Los glows (`box-shadow`) de `.btn-brutal`/`.btn-brutal-outline`/`.card-brutal`/Nav pasan de un `rgba()` fijo a `color-mix(in srgb, var(--color-acid) N%, transparent)`, así siguen automáticamente al acento elegido (funciona igual para los 3 presets que para cualquier color libre). Ver Tasks 2b, 8b, y los steps agregados a 3/6/7/9/10.

**Tech Stack:** Astro 5 + React (islands) + Tailwind CSS v4 (`@theme`/`@layer components` en `src/styles/global.css`). Sin suite de tests automatizada (convención ya establecida del proyecto) — verificación vía `npm run build && npx tsc --noEmit` + recorrido visual manual con Playwright.

---

## Antes de empezar

Antes de arrancar, hacé el trabajo en un worktree aislado vía `superpowers:using-git-worktrees` (no directamente sobre `main`).

## Mapa de archivos

**Fundacional (global.css):**
- `src/styles/global.css` — tokens de radio, limpieza de textura de fondo, reescritura de las 5 clases compartidas, override de tema claro para `.card-brutal`.

**Excepciones puntuales ya identificadas en el spec:**
- `src/components/astro/Nav.astro`
- `src/components/react/Shared/Avatar.tsx`
- `src/components/react/Shared/MapPicker.tsx`
- `src/components/react/Shared/CollapsibleSection.tsx`

**Usos sueltos de `border-2`/variantes por feature (no reimplementan las clases compartidas, pero tienen bordes/anchos hardcodeados):**
- Auth: `SignupForm.tsx`, `ResetPasswordForm.tsx`, `LoginForm.tsx`, `ForgotPasswordForm.tsx`
- Connections: `TrainerSearch.tsx`, `RedeemInvite.tsx`, `PendingRoutineShares.tsx`, `MyConnectionsList.tsx`, `IncomingRequests.tsx`, `Connections.tsx`
- RoutineManager: `RoutineManager.tsx`, `RoutineList.tsx`, `CreateRoutineForm.tsx`, `RoutinePreview.tsx`
- ProgressList: `WorkoutHistory.tsx`, `ProgressList.tsx`, `DisciplineSummary.tsx`
- Profile: `ProfileForm.tsx`
- WorkoutLogger: `WorkoutLogger.tsx`
- SyncBanner: `SyncBanner.tsx`, `ConflictResolution.tsx`
- `MuscleBody.tsx`, `InstallPrompt.tsx`
- `src/pages/index.astro`

29 archivos en total. El resto de la app (41 archivos que ya usan `.btn-brutal`/`.card-brutal`/`.input-brutal`/`.label-brutal` sin overrides sueltos) se actualiza automáticamente con el Task 2, sin tocarlos.

**Acento con degradado (agregado durante la ejecución):**
- `src/lib/theme.ts` — presets, `applyTheme()`.
- `src/layouts/BaseLayout.astro` — script inline duplicado (no puede importar `theme.ts`, corre pre-paint).
- `supabase/schema.sql` — default de la columna (documentación, no una migración funcional).
- `src/components/react/Profile/ProfileForm.tsx` — nuevos swatches de degradado (además del ajuste de bordes ya listado arriba).
- `src/components/react/ActivityPicker/ActivityPicker.tsx` — nuevo, no tenía `border-2` así que no apareció en el relevamiento original.
- Steps nuevos agregados a Tasks 3 (Nav), 4 (Avatar), 6 (Connections: TrainerSearch/PendingRoutineShares), 7 (RoutineManager), 10 (WorkoutLogger) para reemplazar el patrón `border-acid bg-acid text-on-accent` por `pill-selected`/`fill-acid-on`.

---

### Task 1: Tokens de radio + limpieza de textura de fondo

**Files:**
- Modify: `src/styles/global.css:1-20` (tokens + nuevo bloque `:root` de degradado), `src/styles/global.css:44-56` (fondo de `body`)

- [ ] **Step 1: Agregar los tokens de radio al `@theme`, y actualizar los defaults de acento a los del nuevo degradado predeterminado (F3)**

Reemplazar:

```css
  --color-acid: #d7ff3f;
```

Por:

```css
  --color-acid: #67d8f0;
```

(Este es el color sólido representativo del degradado F3 — ver la sección "Acento con degradado" más abajo en este plan. Deja de ser verde ácido porque F3 pasa a ser el acento predeterminado de la app; `text-acid`/`border-acid` en todo el código siguen funcionando igual, ahora resuelven a este tono por default.)

Reemplazar:

```css
  --color-blood: #ff5a36;
  /* Fixed dark color for text drawn on top of the (bright, user-chosen)
     accent fill — unlike ink/paper/surface this does NOT flip with the
     light/dark toggle, since accent fills stay bright in both themes. */
  --color-on-accent: #0c0c0a;
}
```

Por:

```css
  --color-blood: #ff5a36;
  /* Color de texto dibujado ENCIMA de un relleno de acento (botones,
     badges). Antes era fijo porque el acento siempre era brillante; ahora
     puede variar por preset de degradado (ver theme.ts) — este valor es
     solo el default estático previo a que el JS de personalización corra
     (F3, que usa texto oscuro). */
  --color-on-accent: #0c0c0a;

  /* Radios compartidos de la dirección "brutal-glass" (2026-09-22): --radius-X
     en @theme genera automáticamente la utilidad rounded-X, igual que ya pasa
     con --font-X y --color-X de arriba. */
  --radius-card: 16px;
  --radius-control: 10px;
}

/* Superficie de degradado del acento (ver "Acento con degradado" más abajo).
   No es un token --theme porque no necesita generar una utilidad Tailwind —
   se referencia directo como var(--gradient-acid) desde .pill-selected y
   .fill-acid-on. "none" por default; theme.ts la pisa en runtime igual que
   ya hace con --color-acid. El valor estático de acá ya es el degradado F3
   (el nuevo default de la app) para que el primer paint sin JS coincida. */
:root {
  --gradient-acid: linear-gradient(135deg, #22d3ee, #3b82f6);
}
```

- [ ] **Step 2: Sacar la textura de ruido del fondo de `body`, dejando los dos glows radiales**

Reemplazar:

```css
  body {
    background-color: var(--color-ink);
    color: var(--color-paper);
    font-family: var(--font-body);
    background-image: radial-gradient(
        circle at 15% -10%,
        rgb(215 255 63 / 0.1),
        transparent 40%
      ),
      radial-gradient(circle at 100% 0%, rgb(255 90 54 / 0.08), transparent 35%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    background-repeat: no-repeat, no-repeat, repeat;
  }
```

Por:

```css
  body {
    background-color: var(--color-ink);
    color: var(--color-paper);
    font-family: var(--font-body);
    background-image: radial-gradient(
        circle at 15% -10%,
        rgb(215 255 63 / 0.1),
        transparent 40%
      ),
      radial-gradient(circle at 100% 0%, rgb(255 90 54 / 0.08), transparent 35%);
    background-repeat: no-repeat, no-repeat;
  }
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: mismo resultado que antes de este cambio (el único error esperado es el preexistente y no relacionado de `ProgressList.tsx`, documentado en `docs/agents/notas-de-entorno-y-lecciones.md`). Este task no toca ningún `.tsx`, así que no debería cambiar nada acá.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "style: add radius tokens, drop background noise texture"
```

---

### Task 2: Reescribir las 5 clases compartidas + override de tema claro

**Files:**
- Modify: `src/styles/global.css` (bloque `@layer components`, líneas ~71-113 antes del Task 1)

- [ ] **Step 1: Reescribir `.btn-brutal` — sombra offset dura → glow, sin borde (coincide con el mockup aprobado)**

Reemplazar:

```css
  .btn-brutal {
    @apply inline-flex items-center justify-center gap-2 border-2 border-paper bg-acid px-6 py-3
      font-display text-xl uppercase tracking-wide text-on-accent
      shadow-[5px_5px_0_0_var(--color-paper)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--color-paper)]
      active:translate-x-0 active:translate-y-0 active:shadow-none
      disabled:pointer-events-none disabled:opacity-40;
  }
```

Por:

```css
  .btn-brutal {
    @apply inline-flex items-center justify-center gap-2 rounded-control bg-acid px-6 py-3
      font-display text-xl uppercase tracking-wide text-on-accent
      shadow-[0_6px_18px_-2px_color-mix(in_srgb,var(--color-acid)_35%,transparent)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-4px_color-mix(in_srgb,var(--color-acid)_45%,transparent)]
      active:translate-x-0 active:translate-y-0 active:shadow-none
      disabled:pointer-events-none disabled:opacity-40;
    background-image: var(--gradient-acid);
  }
```

(Se usa `color-mix()` en vez de un `rgba()` fijo para que el glow siga automáticamente al acento elegido por cada usuario, y `background-image: var(--gradient-acid)` pinta el degradado sobre el `bg-acid` sólido de base cuando el usuario tiene un preset de degradado activo — ver la sección "Acento con degradado" más abajo en este plan. `color-mix()`/`background-image` con variable tienen soporte amplio en navegadores modernos, suficiente para esta PWA.)

- [ ] **Step 2: Reescribir `.btn-brutal-outline` — mantiene borde (es la variante sin relleno), sombra offset → glow más tenue**

Reemplazar:

```css
  .btn-brutal-outline {
    @apply inline-flex items-center justify-center gap-2 border-2 border-paper bg-transparent px-6 py-3
      font-display text-xl uppercase tracking-wide text-paper
      shadow-[5px_5px_0_0_var(--color-acid)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--color-acid)]
      active:translate-x-0 active:translate-y-0 active:shadow-none
      disabled:pointer-events-none disabled:opacity-40;
  }
```

Por:

```css
  .btn-brutal-outline {
    @apply inline-flex items-center justify-center gap-2 rounded-control border border-paper/30 bg-transparent px-6 py-3
      font-display text-xl uppercase tracking-wide text-paper
      shadow-[0_4px_14px_-2px_color-mix(in_srgb,var(--color-acid)_25%,transparent)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_color-mix(in_srgb,var(--color-acid)_35%,transparent)]
      active:translate-x-0 active:translate-y-0 active:shadow-none
      disabled:pointer-events-none disabled:opacity-40;
  }
```

- [ ] **Step 3: Reescribir `.btn-brutal-sm` — sin sombra (ya era plano), solo borde 1px + radio**

Reemplazar:

```css
  .btn-brutal-sm {
    @apply inline-flex items-center justify-center border-2 border-paper bg-surface-raised px-4 py-2
      font-display text-base uppercase tracking-wide text-paper transition duration-150
      hover:bg-acid hover:text-on-accent active:scale-95
      disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-paper;
  }
```

Por:

```css
  .btn-brutal-sm {
    @apply inline-flex items-center justify-center rounded-control border border-paper/30 bg-surface-raised px-4 py-2
      font-display text-base uppercase tracking-wide text-paper transition duration-150
      hover:bg-acid hover:text-on-accent active:scale-95
      disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-paper;
  }
```

- [ ] **Step 4: Agregar `.pill-selected` y `.fill-acid-on` — las dos clases compartidas para "estado seleccionado/activo con relleno de acento", usadas en decenas de toggles sueltos por toda la app (ver Tasks 3, 6, 7, 9, 10 y la nueva sección de degradados)**

Agregar (al final del bloque `@layer components`, después de `.input-brutal` — no reemplaza nada, es contenido nuevo):

```css
  /* Idioma compartido para "esta opción está seleccionada/activa y tiene
     relleno de acento" — reemplaza el patrón repetido a mano
     `border-acid bg-acid text-on-accent` que aparecía suelto en ~25 lugares
     (toggles de tema/unidad/sexo/nivel, filtros, radios de rutina, etc.).
     Con degradado activo, el relleno se pinta con el degradado en vez de
     lisos — ver "Acento con degradado" más abajo. */
  .pill-selected {
    @apply border-acid bg-acid text-on-accent;
    background-image: var(--gradient-acid);
  }

  /* Igual que .pill-selected pero sin el borde — para los pocos casos donde
     el borde ya se maneja aparte (ej. el CTA circular de "Registrar" en
     Nav, que tiene border-acid tanto activo como inactivo). */
  .fill-acid-on {
    @apply bg-acid text-on-accent;
    background-image: var(--gradient-acid);
  }
```

- [ ] **Step 5: Reescribir `.card-brutal` — vidrio translúcido con blur en oscuro, y agregar el override sólido de tema claro**

Reemplazar:

```css
  .card-brutal {
    @apply border-2 border-paper-dim/40 bg-surface p-5;
  }
```

Por:

```css
  .card-brutal {
    @apply rounded-card border border-paper/10 bg-paper/5 p-5 backdrop-blur-md
      shadow-[0_8px_30px_-14px_color-mix(in_srgb,var(--color-acid)_20%,transparent)];
  }

  /* El vidrio translúcido con blur se ve bien sobre el fondo oscuro pero
     lavado/de bajo contraste sobre claro (confirmado con mockup durante el
     brainstorm) — en tema claro .card-brutal pasa a fondo sólido opaco
     (reusa el token --color-surface, ya correctamente tintado por el bloque
     :root[data-theme="light"] de arriba) sin blur y con sombra suave normal. */
  :root[data-theme='light'] .card-brutal {
    background-color: var(--color-surface);
    backdrop-filter: none;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  }
```

- [ ] **Step 6: Reescribir `.input-brutal` — borde 1px + radio, sin cambios de color/foco**

Reemplazar:

```css
  .input-brutal {
    @apply w-full border-2 border-paper-dim/50 bg-surface px-3 py-2 font-mono text-paper
      placeholder:text-paper-dim/60 focus:border-acid focus:outline-none disabled:opacity-40;
  }
```

Por:

```css
  .input-brutal {
    @apply w-full rounded-control border border-paper-dim/50 bg-surface px-3 py-2 font-mono text-paper
      placeholder:text-paper-dim/60 focus:border-acid focus:outline-none disabled:opacity-40;
  }
```

- [ ] **Step 7: Build completo (esto toca CSS usado en toda la app)**

Run: `npm run build`
Expected: build exitoso, sin errores de Tailwind (clases `rounded-card`/`rounded-control` deben resolver porque se generan automáticamente desde los tokens `--radius-card`/`--radius-control` agregados en el Task 1).

- [ ] **Step 8: Commit**

```bash
git add src/styles/global.css
git commit -m "style: rework shared brutal-* classes to brutal-glass (glow shadows, rounded corners, glass cards, solid light-theme cards, gradient-aware fills)"
```

---

### Task 2b: Presets de degradado — `theme.ts`, `BaseLayout.astro`, `supabase/schema.sql`

Pedido de Pam durante la ejecución (no estaba en el spec original): el acento pasa a tener 3 presets de degradado curados (F1 azul→morado, F2 morado→magenta, F3 cian→azul — F3 queda como el nuevo default de la app) elegidos con mockups durante el brainstorm, que **conviven** con el selector de color sólido libre que ya existía en Perfil — no lo reemplazan. Este task pone la lógica; el Task 8b (`ActivityPicker.tsx`) y el resto de los tasks ya escritos (3, 4, 6, 7, 9, 10) consumen las clases `pill-selected`/`fill-acid-on` que ya quedaron definidas en el Task 2, así que este task tiene que ejecutarse **antes** del Task 9 (que importa estos presets) — por eso va acá y no al final del plan.

**Files:**
- Modify: `src/lib/theme.ts` (reescritura completa)
- Modify: `src/layouts/BaseLayout.astro:33-52` (script inline de tema)
- Modify: `supabase/schema.sql:121` (default de la columna — ver nota, corregida tras la revisión final: sí es un código alcanzable)

- [ ] **Step 1: Reescribir `theme.ts` con los 3 presets, mantiene compatibilidad con hex sólidos ya guardados**

Reemplazar el archivo completo:

```ts
export type ThemeMode = 'light' | 'dark';

export const DEFAULT_ACCENT = '#d7ff3f';
export const THEME_STORAGE_KEY = 'selfgains-theme';
export const ACCENT_STORAGE_KEY = 'selfgains-accent';

// Applies the theme/accent to the current page immediately (so a change in
// the profile picker previews live) and caches it in localStorage so the
// inline head script in BaseLayout can paint the right theme on the very
// next page load before any component has fetched the Supabase profile.
export function applyTheme(theme: ThemeMode, accentColor: string): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--color-acid', accentColor);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // the theme still applies for this page load, it just won't persist.
  }
}
```

Por:

```ts
export type ThemeMode = 'light' | 'dark';

export type AccentGradientId = 'f1' | 'f2' | 'f3';

interface AccentGradientPreset {
  gradient: string;
  solid: string;
  onAccent: string;
}

// 3 presets curados con mockups durante el brainstorm de modernización
// (2026-09-22) — conviven con la opción de color sólido libre que ya
// existía (el <input type="color"> en ProfileForm), no la reemplazan.
// `solid` es el color representativo usado para texto/bordes (--color-acid,
// que no puede llevar un degradado — solo background-image sí). `onAccent`
// varía por preset porque F2 (magenta) necesita texto claro para contraste,
// a diferencia de los otros dos.
export const ACCENT_GRADIENTS: Record<AccentGradientId, AccentGradientPreset> = {
  f1: { gradient: 'linear-gradient(135deg, #4f9dfe, #9b5cf6)', solid: '#8fb4fb', onAccent: '#0c0c0a' },
  f2: { gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)', solid: '#c98cf0', onAccent: '#ffffff' },
  f3: { gradient: 'linear-gradient(135deg, #22d3ee, #3b82f6)', solid: '#67d8f0', onAccent: '#0c0c0a' },
};

export const DEFAULT_ACCENT: AccentGradientId = 'f3';
export const THEME_STORAGE_KEY = 'selfgains-theme';
export const ACCENT_STORAGE_KEY = 'selfgains-accent';

function isAccentGradientId(value: string): value is AccentGradientId {
  return value === 'f1' || value === 'f2' || value === 'f3';
}

// El acento guardado es o bien uno de los 3 ids de degradado curados
// ("f1"/"f2"/"f3") o un hex sólido elegido libremente por el usuario con el
// selector de color nativo (compatibilidad con lo que ya se guardaba antes
// de que existieran los degradados — no hace falta migrar datos
// existentes, se distingue por la forma del string). Aplica siempre las
// tres variables juntas: --color-acid (sólido, para texto/borde),
// --gradient-acid (para los rellenos que la soportan, "none" en modo
// sólido) y --color-on-accent (texto legible arriba del relleno).
export function applyTheme(theme: ThemeMode, accent: string): void {
  document.documentElement.dataset.theme = theme;
  const root = document.documentElement.style;
  if (isAccentGradientId(accent)) {
    const preset = ACCENT_GRADIENTS[accent];
    root.setProperty('--color-acid', preset.solid);
    root.setProperty('--gradient-acid', preset.gradient);
    root.setProperty('--color-on-accent', preset.onAccent);
  } else {
    root.setProperty('--color-acid', accent);
    root.setProperty('--gradient-acid', 'none');
    root.setProperty('--color-on-accent', '#0c0c0a');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // the theme still applies for this page load, it just won't persist.
  }
}
```

- [ ] **Step 2: Reescribir el script inline de `BaseLayout.astro` con la misma lógica de presets (no puede importar `theme.ts` — es `is:inline`, corre síncrono antes del primer paint)**

Reemplazar:

```astro
    <script is:inline>
      (function () {
        function applyStoredTheme() {
          try {
            var theme = localStorage.getItem('selfgains-theme') || 'dark';
            var accent = localStorage.getItem('selfgains-accent') || '#d7ff3f';
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.setProperty('--color-acid', accent);
          } catch (e) {}
        }
        applyStoredTheme();
        // Astro's ClientRouter (View Transitions) swaps document.documentElement
        // on every internal nav to the fresh SSG markup, which has no inline
        // style/dataset — this script only runs once on the initial hard load,
        // so without re-running it here the theme/accent silently reverts to
        // the CSS default on the very next nav click. astro:after-swap fires
        // right after the swap but before paint, so there's no visible flash.
        document.addEventListener('astro:after-swap', applyStoredTheme);
      })();
    </script>
```

Por:

```astro
    <script is:inline>
      (function () {
        // Duplica ACCENT_GRADIENTS de src/lib/theme.ts a propósito — este
        // script es is:inline y corre síncrono en <head>, antes del primer
        // paint, así que no puede hacer un import de módulo. Si se agrega/
        // cambia un preset en theme.ts, hay que espejarlo acá también.
        var GRADIENTS = {
          f1: { gradient: 'linear-gradient(135deg, #4f9dfe, #9b5cf6)', solid: '#8fb4fb', onAccent: '#0c0c0a' },
          f2: { gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)', solid: '#c98cf0', onAccent: '#ffffff' },
          f3: { gradient: 'linear-gradient(135deg, #22d3ee, #3b82f6)', solid: '#67d8f0', onAccent: '#0c0c0a' },
        };
        function applyStoredTheme() {
          try {
            var theme = localStorage.getItem('selfgains-theme') || 'dark';
            var accent = localStorage.getItem('selfgains-accent') || 'f3';
            document.documentElement.dataset.theme = theme;
            var preset = GRADIENTS[accent];
            if (preset) {
              document.documentElement.style.setProperty('--color-acid', preset.solid);
              document.documentElement.style.setProperty('--gradient-acid', preset.gradient);
              document.documentElement.style.setProperty('--color-on-accent', preset.onAccent);
            } else {
              document.documentElement.style.setProperty('--color-acid', accent);
              document.documentElement.style.setProperty('--gradient-acid', 'none');
              document.documentElement.style.setProperty('--color-on-accent', '#0c0c0a');
            }
          } catch (e) {}
        }
        applyStoredTheme();
        // Astro's ClientRouter (View Transitions) swaps document.documentElement
        // on every internal nav to the fresh SSG markup, which has no inline
        // style/dataset — this script only runs once on the initial hard load,
        // so without re-running it here the theme/accent silently reverts to
        // the CSS default on the very next nav click. astro:after-swap fires
        // right after the swap but before paint, so there's no visible flash.
        document.addEventListener('astro:after-swap', applyStoredTheme);
      })();
    </script>
```

- [ ] **Step 3: Actualizar el default de la columna en `supabase/schema.sql` (corrección post-revisión final: esto SÍ es código alcanzable, no solo documentación — `upsertProfile()` en `src/lib/profile.ts` hace un upsert parcial con `{ user_id, ...changes }`; si la primera escritura de un usuario nuevo no incluye `accent_color` — ej. tocar el toggle de sexo/nivel antes que el picker de acento — la fila se crea usando este default. Dejarlo en `'#d7ff3f'` viejo habría causado un flash visible verde-ácido→degradado-F3 la primera vez que Perfil carga ese perfil recién creado; cambiarlo a `'f3'` evita ese flash y no es opcional)**

Reemplazar:

```sql
  accent_color text not null default '#d7ff3f',
```

Por:

```sql
  accent_color text not null default 'f3',
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`. (`ProfileForm.tsx` todavía no importa los nuevos tipos — eso es el Task 9 — así que en este punto no debería haber ningún error nuevo relacionado a este cambio.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/layouts/BaseLayout.astro supabase/schema.sql
git commit -m "feat: add curated accent gradient presets alongside existing solid custom color"
```

---

### Task 3: `Nav.astro`

**Files:**
- Modify: `src/components/astro/Nav.astro:33,58,78,88,102`

- [ ] **Step 1: Header — borde inferior 1px**

Reemplazar:

```astro
<header class="sticky top-0 z-50 border-b-2 border-paper bg-ink/95 backdrop-blur">
```

Por:

```astro
<header class="sticky top-0 z-50 border-b border-paper/20 bg-ink/95 backdrop-blur">
```

- [ ] **Step 2: Links del nav de escritorio — de caja de 2px a radio + borde fino, y relleno activo con clase compartida (gradiente cuando el usuario tiene uno activo)**

Reemplazar:

```astro
            class:list={[
              "flex items-center gap-2 border-2 px-3 py-2 transition-colors duration-150",
              isActive(link.href)
                ? "border-acid bg-acid text-on-accent"
                : "border-transparent text-paper hover:border-paper-dim/50 hover:text-acid",
            ]}
```

Por:

```astro
            class:list={[
              "flex items-center gap-2 rounded-control border px-3 py-2 transition-colors duration-150",
              isActive(link.href)
                ? "pill-selected"
                : "border-transparent text-paper hover:border-paper-dim/50 hover:text-acid",
            ]}
```

- [ ] **Step 3: Barra inferior mobile — borde superior 1px**

Reemplazar:

```astro
<nav
  class="fixed inset-x-0 bottom-0 z-50 border-t-2 border-paper bg-ink/95 backdrop-blur sm:hidden"
  style="padding-bottom: env(safe-area-inset-bottom);"
>
```

Por:

```astro
<nav
  class="fixed inset-x-0 bottom-0 z-50 border-t border-paper/20 bg-ink/95 backdrop-blur sm:hidden"
  style="padding-bottom: env(safe-area-inset-bottom);"
>
```

- [ ] **Step 4: Botón circular "Registrar" — borde 1px + glow (es el CTA principal, se lo trata como `.btn-brutal`); relleno activo usa `.fill-acid-on` (gradiente cuando corresponde) — el borde ya es `border-acid` fijo en ambos estados, por eso no usa `.pill-selected` (que traería su propio borde redundante)**

Reemplazar:

```astro
              class:list={[
                "-mt-7 flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors duration-150",
                isActive(link.href) ? "border-acid bg-acid text-on-accent" : "border-acid bg-ink text-acid",
              ]}
```

Por:

```astro
              class:list={[
                "-mt-7 flex h-14 w-14 items-center justify-center rounded-full border border-acid shadow-[0_6px_18px_-2px_color-mix(in_srgb,var(--color-acid)_35%,transparent)] transition-colors duration-150",
                isActive(link.href) ? "fill-acid-on" : "bg-ink text-acid",
              ]}
```

- [ ] **Step 5: Indicador de tab activa (mobile) — de 2px a 1px, sigue siendo solo una línea, no una caja**

Reemplazar:

```astro
              "flex flex-col items-center justify-center gap-1 border-t-2 py-2.5 text-center leading-tight transition-colors duration-150",
```

Por:

```astro
              "flex flex-col items-center justify-center gap-1 border-t py-2.5 text-center leading-tight transition-colors duration-150",
```

- [ ] **Step 6: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/astro/Nav.astro
git commit -m "style: apply brutal-glass treatment to Nav (thin borders, rounded active link, glow on Registrar CTA)"
```

---

### Task 4: Componentes compartidos chicos — `Avatar.tsx`, `MapPicker.tsx`, `CollapsibleSection.tsx`

**Files:**
- Modify: `src/components/react/Shared/Avatar.tsx:11,24`
- Modify: `src/components/react/Shared/MapPicker.tsx:152`
- Modify: `src/components/react/Shared/CollapsibleSection.tsx:27`

- [ ] **Step 1: `Avatar.tsx` — ya son círculos (`rounded-full`), solo se afina el ancho de borde**

Reemplazar:

```tsx
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-paper-dim/40 bg-surface">
```

Por:

```tsx
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-paper-dim/40 bg-surface">
```

Reemplazar:

```tsx
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-acid font-display text-sm text-on-accent"
```

Por (el badge de entrenador es un relleno de acento permanente, no un toggle — usa `fill-acid-on` para que también muestre el degradado; el borde queda aparte porque es `border-ink`, no `border-acid`):

```tsx
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-ink fill-acid-on font-display text-sm"
```

- [ ] **Step 2: `MapPicker.tsx` — el contenedor del mapa pasa a ser una tarjeta redondeada**

Reemplazar:

```tsx
  return <div ref={containerRef} style={{ height, width: '100%' }} className="border-2 border-paper-dim/40" />;
```

Por:

```tsx
  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-card overflow-hidden border border-paper-dim/40"
    />
  );
```

(El `overflow-hidden` es necesario para que el mapa de Leaflet, que se monta dentro de este div, respete las esquinas redondeadas en vez de dibujarse rectangular por encima.)

- [ ] **Step 3: `CollapsibleSection.tsx` — el botón cerrado imita `.btn-brutal-sm`, se le da el mismo tratamiento**

Reemplazar:

```tsx
            ? 'flex w-full items-center justify-between gap-3 text-left'
            : 'flex w-full items-center justify-between gap-3 border-2 border-paper bg-surface-raised px-4 py-3 text-left text-paper transition duration-150 hover:bg-acid hover:text-on-accent active:scale-[0.98]'
```

Por:

```tsx
            ? 'flex w-full items-center justify-between gap-3 text-left'
            : 'flex w-full items-center justify-between gap-3 rounded-control border border-paper/30 bg-surface-raised px-4 py-3 text-left text-paper transition duration-150 hover:bg-acid hover:text-on-accent active:scale-[0.98]'
```

- [ ] **Step 4: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/Shared/Avatar.tsx src/components/react/Shared/MapPicker.tsx src/components/react/Shared/CollapsibleSection.tsx
git commit -m "style: apply brutal-glass treatment to Avatar, MapPicker and CollapsibleSection"
```

---

### Task 5: Formularios de Auth — mensajes de error (4 archivos)

Los 4 comparten el mismo patrón de una sola línea: el acento de color a la izquierda del mensaje de error pasa de 2px a 1px (sigue siendo una línea divisoria, no una caja — sin radio).

**Files:**
- Modify: `src/components/react/Auth/SignupForm.tsx:96`
- Modify: `src/components/react/Auth/ResetPasswordForm.tsx:117`
- Modify: `src/components/react/Auth/LoginForm.tsx:78`
- Modify: `src/components/react/Auth/ForgotPasswordForm.tsx:53`

- [ ] **Step 1: `SignupForm.tsx`**

Reemplazar:

```tsx
        {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
        {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 2: `ResetPasswordForm.tsx`**

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 3: `LoginForm.tsx`**

Reemplazar:

```tsx
        {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
        {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 4: `ForgotPasswordForm.tsx`**

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Auth/SignupForm.tsx src/components/react/Auth/ResetPasswordForm.tsx src/components/react/Auth/LoginForm.tsx src/components/react/Auth/ForgotPasswordForm.tsx
git commit -m "style: thin the error-message accent border in Auth forms"
```

---

### Task 6: Feature Connections (6 archivos)

**Files:**
- Modify: `src/components/react/Connections/TrainerSearch.tsx:61`
- Modify: `src/components/react/Connections/RedeemInvite.tsx:53`
- Modify: `src/components/react/Connections/PendingRoutineShares.tsx:66`
- Modify: `src/components/react/Connections/MyConnectionsList.tsx:63,103`
- Modify: `src/components/react/Connections/IncomingRequests.tsx:28`
- Modify: `src/components/react/Connections/Connections.tsx:316`

- [ ] **Step 1: `TrainerSearch.tsx` — botón chico, agrega radio, y el filtro de radio seleccionado pasa a `pill-selected`**

Reemplazar:

```tsx
          className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Por:

```tsx
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
            className={radiusKm === km ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
```

Por:

```tsx
            className={radiusKm === km ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
```

- [ ] **Step 2: `RedeemInvite.tsx` — mensaje de error, solo línea**

Reemplazar:

```tsx
  return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
```

Por:

```tsx
  return <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
```

- [ ] **Step 3: `PendingRoutineShares.tsx` — botón chico, agrega radio, y el botón "Aceptar" pasa a `pill-selected`**

Reemplazar:

```tsx
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
                className="btn-brutal-sm border-acid bg-acid text-on-accent"
```

Por:

```tsx
                className="btn-brutal-sm pill-selected"
```

- [ ] **Step 4: `MyConnectionsList.tsx` — dos botones chicos, agrega radio en ambos**

Reemplazar:

```tsx
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Por:

```tsx
        className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

- [ ] **Step 5: `IncomingRequests.tsx` — botón chico, agrega radio**

Reemplazar:

```tsx
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

- [ ] **Step 6: `Connections.tsx` — mensaje de error, solo línea**

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/react/Connections/TrainerSearch.tsx src/components/react/Connections/RedeemInvite.tsx src/components/react/Connections/PendingRoutineShares.tsx src/components/react/Connections/MyConnectionsList.tsx src/components/react/Connections/IncomingRequests.tsx src/components/react/Connections/Connections.tsx
git commit -m "style: apply brutal-glass treatment across Connections feature"
```

---

### Task 7: Feature RoutineManager (4 archivos)

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx:258,266,297`
- Modify: `src/components/react/RoutineManager/RoutineList.tsx:88,124,171,178`
- Modify: `src/components/react/RoutineManager/CreateRoutineForm.tsx:147,156,163,271`
- Modify: `src/components/react/RoutineManager/RoutinePreview.tsx:25`

- [ ] **Step 1: `RoutineManager.tsx` — dos botones chicos + un mensaje de error + dos toggles de filtro que pasan a `pill-selected`**

Reemplazar:

```tsx
              className="shrink-0 border-2 border-blood bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
              className="shrink-0 rounded-control border border-blood bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Reemplazar:

```tsx
              className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Por:

```tsx
              className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Reemplazar (aparece 2 veces, líneas 308 y 319 — reemplazar ambas apariciones):

```tsx
                  ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
```

Por:

```tsx
                  ? 'btn-brutal-sm pill-selected'
```

- [ ] **Step 2: `RoutineList.tsx` — cuatro botones chicos (dos pares repetidos)**

Reemplazar (aparece 2 veces, en las líneas 88 y 171 — hacer el reemplazo en ambas apariciones):

```tsx
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
```

Por:

```tsx
        className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
```

Reemplazar:

```tsx
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Por:

```tsx
        className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

(Nota para quien implemente: `RoutineList.tsx` tiene 4 apariciones de `border-2` en total — 2 son textualmente idénticas entre sí (líneas 88 y 171, mismo texto exacto de arriba), y las otras 2 son cada una única (líneas 124 y 178). Usar reemplazo de todas las ocurrencias del string idéntico para las líneas 88/171.)

- [ ] **Step 3: `CreateRoutineForm.tsx` — dos botones ±cantidad idénticos, un botón "Quitar" y un mensaje de error**

Reemplazar (aparece 2 veces, líneas 147 y 156 — reemplazar ambas apariciones):

```tsx
                    className="flex h-7 w-7 items-center justify-center border-2 border-paper-dim/60 text-acid transition duration-150 hover:border-paper hover:text-paper active:scale-95 disabled:pointer-events-none disabled:opacity-30"
```

Por:

```tsx
                    className="flex h-7 w-7 items-center justify-center rounded-control border border-paper-dim/60 text-acid transition duration-150 hover:border-paper hover:text-paper active:scale-95 disabled:pointer-events-none disabled:opacity-30"
```

Reemplazar:

```tsx
                    className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                    className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 4: `RoutinePreview.tsx` — wrapper con acento a la izquierda, solo línea**

Reemplazar:

```tsx
    <div className="flex flex-col gap-2 border-l-2 border-paper-dim/40 pl-3">
```

Por:

```tsx
    <div className="flex flex-col gap-2 border-l border-paper-dim/40 pl-3">
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/RoutineManager/RoutineManager.tsx src/components/react/RoutineManager/RoutineList.tsx src/components/react/RoutineManager/CreateRoutineForm.tsx src/components/react/RoutineManager/RoutinePreview.tsx
git commit -m "style: apply brutal-glass treatment across RoutineManager feature"
```

---

### Task 8: Feature ProgressList (3 archivos)

**Files:**
- Modify: `src/components/react/ProgressList/WorkoutHistory.tsx:121,128,226,233,302,318`
- Modify: `src/components/react/ProgressList/ProgressList.tsx:154`
- Modify: `src/components/react/ProgressList/DisciplineSummary.tsx:28`

- [ ] **Step 1: `WorkoutHistory.tsx` — cinco botones chicos (dos pares idénticos + uno único) y un mensaje de error**

Reemplazar (aparece 2 veces, líneas 121 y 226 — reemplazar ambas):

```tsx
          className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
```

Por:

```tsx
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
```

Reemplazar (aparece 2 veces, líneas 128 y 233 — reemplazar ambas):

```tsx
          className="border-2 border-blood bg-transparent px-2 py-1 text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
          className="rounded-control border border-blood bg-transparent px-2 py-1 text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Reemplazar:

```tsx
              className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
              className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

- [ ] **Step 2: `ProgressList.tsx` — mensaje de error, solo línea**

Reemplazar:

```tsx
    return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
```

Por:

```tsx
    return <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
```

- [ ] **Step 3: `DisciplineSummary.tsx` — acento de color por disciplina, de 4px a 1px (el color lo sigue llevando el `style` inline, no cambia)**

Reemplazar:

```tsx
            className={`card-brutal card-brutal-tap flex flex-col gap-1 border-t-4 text-left transition-colors hover:border-acid ${
```

Por:

```tsx
            className={`card-brutal card-brutal-tap flex flex-col gap-1 border-t text-left transition-colors hover:border-acid ${
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx` (el mismo error de siempre, en este archivo — confirmar con `git stash` si hay dudas de si es nuevo, tal como documenta `docs/agents/notas-de-entorno-y-lecciones.md`).

- [ ] **Step 5: Commit**

```bash
git add src/components/react/ProgressList/WorkoutHistory.tsx src/components/react/ProgressList/ProgressList.tsx src/components/react/ProgressList/DisciplineSummary.tsx
git commit -m "style: apply brutal-glass treatment across ProgressList feature"
```

---

### Task 8b: `ActivityPicker.tsx`

No tenía ningún `border-2`, por eso no apareció en el relevamiento original del spec — pero sí usa el patrón `border-acid bg-acid text-on-accent` dos veces para marcar disciplina/grupo seleccionado, así que necesita el mismo tratamiento `pill-selected` que el resto de la app.

**Files:**
- Modify: `src/components/react/ActivityPicker/ActivityPicker.tsx:79,96`

- [ ] **Step 1: Disciplina seleccionada (línea 79) pasa a `pill-selected`**

Reemplazar:

```tsx
                ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                : 'btn-brutal-sm opacity-60'
            }
          >
            {d.label}
```

Por:

```tsx
                ? 'btn-brutal-sm pill-selected'
                : 'btn-brutal-sm opacity-60'
            }
          >
            {d.label}
```

- [ ] **Step 2: Grupo seleccionado (línea 96, un nivel de indentación más adentro — no confundir con el bloque anterior) pasa a `pill-selected`**

Reemplazar:

```tsx
                  ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                  : 'btn-brutal-sm opacity-60'
```

Por:

```tsx
                  ? 'btn-brutal-sm pill-selected'
                  : 'btn-brutal-sm opacity-60'
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ActivityPicker/ActivityPicker.tsx
git commit -m "style: use pill-selected for discipline/group filters in ActivityPicker"
```

---

### Task 9: `ProfileForm.tsx`

Esta pantalla es la que más toques necesita: además del ajuste de bordes/radio ya planeado, es donde vive el picker de acento — se le agregan los 3 swatches de degradado (conviven con los 6 sólidos existentes y con el selector de color libre) — y tiene 14 apariciones del patrón `border-acid bg-acid text-on-accent` para sus toggles (tema, unidad de peso, sexo, nivel).

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx` (imports, tipos, picker de acento, 14 toggles, bordes, mensajes)

- [ ] **Step 1: Import y tipo del estado de acento — `DEFAULT_ACCENT` deja de ser un hex, ahora es un id de preset**

Reemplazar:

```tsx
import { applyTheme, DEFAULT_ACCENT, type ThemeMode } from '../../../lib/theme';
```

Por:

```tsx
import { ACCENT_GRADIENTS, applyTheme, DEFAULT_ACCENT, type AccentGradientId, type ThemeMode } from '../../../lib/theme';
```

Reemplazar:

```tsx
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
```

Por:

```tsx
  // string, no AccentGradientId — accentColor termina guardando tanto ids de
  // preset ("f1"/"f2"/"f3") como hex sueltos del selector de color libre,
  // y también lo que venga de profile.accent_color (columna text en
  // Supabase, sin CHECK que restrinja el formato).
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT);
```

- [ ] **Step 2: Picker de acento — se agregan los 3 swatches de degradado antes de los sólidos existentes, y el input de color libre se blinda contra un `accentColor` que no sea hex**

Reemplazar:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => handleAccentChange(color)}
              style={{ backgroundColor: color }}
              className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${
                accentColor.toLowerCase() === color ? 'scale-110 border-paper' : 'border-paper-dim/40'
              }`}
            />
          ))}
          <input
            type="color"
            value={accentColor}
            onChange={(e) => handleAccentChange(e.target.value)}
            aria-label="Elegir color personalizado"
            className="h-8 w-8 cursor-pointer border-2 border-paper-dim/40 bg-transparent p-0"
          />
        </div>
```

Por:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(ACCENT_GRADIENTS) as [AccentGradientId, (typeof ACCENT_GRADIENTS)[AccentGradientId]][]).map(
            ([id, preset]) => (
              <button
                key={id}
                type="button"
                aria-label={`Degradado ${id}`}
                onClick={() => handleAccentChange(id)}
                style={{ backgroundImage: preset.gradient }}
                className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${
                  accentColor === id ? 'scale-110 border-paper' : 'border-paper-dim/40'
                }`}
              />
            )
          )}
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => handleAccentChange(color)}
              style={{ backgroundColor: color }}
              className={`h-8 w-8 rounded-full border transition-transform duration-150 ${
                accentColor.toLowerCase() === color ? 'scale-110 border-paper' : 'border-paper-dim/40'
              }`}
            />
          ))}
          <input
            type="color"
            value={accentColor.startsWith('#') ? accentColor : '#000000'}
            onChange={(e) => handleAccentChange(e.target.value)}
            aria-label="Elegir color personalizado"
            className="h-8 w-8 cursor-pointer rounded-control border border-paper-dim/40 bg-transparent p-0"
          />
        </div>
```

(Los 3 swatches de degradado quedan primero — son las opciones curadas y F3 es el default nuevo. Los 6 swatches sólidos y el selector libre siguen exactamente igual que antes, nada se les saca. El `value={accentColor.startsWith('#') ? accentColor : '#000000'}` evita que el `<input type="color">` reciba un valor inválido tipo `"f1"` cuando hay un degradado activo — sin esto el navegador lo trataría como error silencioso.)

- [ ] **Step 3: Los 14 toggles de "opción seleccionada" (tema, unidad de peso, sexo, nivel) pasan a `pill-selected` — son 2 substrings distintos, ambos se repiten varias veces**

Reemplazar (aparece 12 veces en total, en las líneas 304, 311, 346, 355, 372, 379, 386, 400, 409, 418, 427 y 489 — reemplazar las 12 apariciones):

```tsx
'btn-brutal-sm border-acid bg-acid text-on-accent'
```

Por:

```tsx
'btn-brutal-sm pill-selected'
```

Reemplazar (aparece 2 veces, líneas 452 y 475 — reemplazar ambas apariciones; noten el `self-start` extra que no tiene el bloque anterior, por eso es un substring separado):

```tsx
'btn-brutal-sm self-start border-acid bg-acid text-on-accent'
```

Por:

```tsx
'btn-brutal-sm self-start pill-selected'
```

- [ ] **Step 4: Mensajes de error/guardado del formulario — solo línea**

Reemplazar:

```tsx
        {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        {savedMessage && (
          <p className="border-l-2 border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
        )}
```

Por:

```tsx
        {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        {savedMessage && (
          <p className="border-l border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
        )}
```

- [ ] **Step 5: Botones "Cerrar sesión" y "Borrar cuenta" — agregan radio**

Reemplazar:

```tsx
        className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
        className="self-start rounded-control border border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Reemplazar:

```tsx
        className="self-start border-2 border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95 disabled:opacity-50"
```

Por:

```tsx
        className="self-start rounded-control border border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95 disabled:opacity-50"
```

- [ ] **Step 6: Mensaje de error de borrado de cuenta — solo línea**

Reemplazar:

```tsx
        <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{deleteError}</p>
```

Por:

```tsx
        <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{deleteError}</p>
```

- [ ] **Step 7: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx`. Si tsc marca algo en `ProfileForm.tsx`, lo más probable es que el Step 3 haya dejado alguna de las 14 apariciones sin reemplazar (revisar con `grep -n "border-acid bg-acid text-on-accent" src/components/react/Profile/ProfileForm.tsx` — no debería quedar ninguna).

- [ ] **Step 8: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "style: apply brutal-glass treatment to ProfileForm, add gradient accent swatches"
```

---

### Task 10: `WorkoutLogger.tsx`

**Files:**
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx:264,281,292,412,787,953,956,990,993,1024,1026`

- [ ] **Step 1: Botones ± de cantidad — dos botones idénticos, agregan radio**

Reemplazar (aparece 2 veces, líneas 264 y 281 — reemplazar ambas):

```tsx
          className="h-14 w-14 shrink-0 border-2 border-paper-dim/50 font-display text-2xl text-paper transition-transform duration-100 active:scale-95 active:border-acid active:text-acid"
```

Por:

```tsx
          className="h-14 w-14 shrink-0 rounded-control border border-paper-dim/50 font-display text-2xl text-paper transition-transform duration-100 active:scale-95 active:border-acid active:text-acid"
```

- [ ] **Step 2: Botones de preset de peso — agrega radio, mantiene los dos estados condicionales, y el preset elegido pasa a `pill-selected`**

Reemplazar:

```tsx
            className={`h-12 min-w-[4.5rem] flex-1 border-2 font-mono text-sm transition-colors ${
```

Por:

```tsx
            className={`h-12 min-w-[4.5rem] flex-1 rounded-control border font-mono text-sm transition-colors ${
```

Reemplazar:

```tsx
                ? 'border-acid bg-acid text-on-accent'
                : 'border-paper-dim/50 text-paper-dim hover:border-acid hover:text-acid'
```

Por:

```tsx
                ? 'pill-selected'
                : 'border-paper-dim/50 text-paper-dim hover:border-acid hover:text-acid'
```

- [ ] **Step 3: Badge "✓ Hecho" — agrega radio**

Reemplazar:

```tsx
            <span className="shrink-0 border-2 border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
```

Por:

```tsx
            <span className="shrink-0 rounded-control border border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
```

- [ ] **Step 4: Barra de progreso — ya es `rounded-full`, solo ancho en el contenedor; el relleno se pinta con el degradado del acento (no usa `.fill-acid-on`/`.pill-selected` porque no lleva texto encima, solo necesita el fondo)**

Reemplazar:

```tsx
              <div className="h-3 w-full overflow-hidden rounded-full border-2 border-paper-dim/30 bg-surface-raised">
```

Por:

```tsx
              <div className="h-3 w-full overflow-hidden rounded-full border border-paper-dim/30 bg-surface-raised">
```

Reemplazar:

```tsx
                  className="h-full bg-acid transition-all duration-300"
```

Por:

```tsx
                  className="h-full bg-acid transition-all duration-300 [background-image:var(--gradient-acid)]"
```

- [ ] **Step 5: Wrappers de tabla — dos idénticos en estructura, cada uno con su propio ancho de header debajo**

Reemplazar:

```tsx
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[480px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
```

Por:

```tsx
        <div className="overflow-x-auto rounded-card border border-paper-dim/30">
          <table className="w-full min-w-[480px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
```

Reemplazar:

```tsx
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[420px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
```

Por:

```tsx
        <div className="overflow-x-auto rounded-card border border-paper-dim/30">
          <table className="w-full min-w-[420px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
```

- [ ] **Step 6: Mensajes de error/guardado al pie — solo línea**

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Reemplazar:

```tsx
        <p key={savedMessage} className="reveal border-l-2 border-acid pl-3 font-mono text-sm text-acid">
```

Por:

```tsx
        <p key={savedMessage} className="reveal border-l border-acid pl-3 font-mono text-sm text-acid">
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/react/WorkoutLogger/WorkoutLogger.tsx
git commit -m "style: apply brutal-glass treatment to WorkoutLogger"
```

---

### Task 11: Feature SyncBanner (2 archivos)

**Files:**
- Modify: `src/components/react/SyncBanner/SyncBanner.tsx:43,51`
- Modify: `src/components/react/SyncBanner/ConflictResolution.tsx:147`

- [ ] **Step 1: `SyncBanner.tsx` — dos franjas de ancho completo (chrome, no caja) — solo línea**

Reemplazar:

```tsx
        className="reveal block border-b-2 border-blood bg-surface px-4 py-2 text-center font-mono text-sm text-blood hover:text-paper"
```

Por:

```tsx
        className="reveal block border-b border-blood bg-surface px-4 py-2 text-center font-mono text-sm text-blood hover:text-paper"
```

Reemplazar:

```tsx
    <p className="reveal border-b-2 border-acid bg-surface px-4 py-2 text-center font-mono text-sm text-paper-dim">
```

Por:

```tsx
    <p className="reveal border-b border-acid bg-surface px-4 py-2 text-center font-mono text-sm text-paper-dim">
```

- [ ] **Step 2: `ConflictResolution.tsx` — mensaje de error, solo línea**

Reemplazar:

```tsx
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

Por:

```tsx
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/SyncBanner/SyncBanner.tsx src/components/react/SyncBanner/ConflictResolution.tsx
git commit -m "style: thin borders across SyncBanner feature"
```

---

### Task 12: `MuscleBody.tsx` + `InstallPrompt.tsx`

**Files:**
- Modify: `src/components/react/MuscleBody/MuscleBody.tsx:702`
- Modify: `src/components/react/InstallPrompt/InstallPrompt.tsx:56`

- [ ] **Step 1: `MuscleBody.tsx` — contenedor del explorador de músculos, pasa a tarjeta redondeada**

Reemplazar:

```tsx
    <div className="h-[420px] border-2 border-paper-dim/30 sm:h-[520px]">
```

Por:

```tsx
    <div className="h-[420px] overflow-hidden rounded-card border border-paper-dim/30 sm:h-[520px]">
```

- [ ] **Step 2: `InstallPrompt.tsx` — banner tipo callout, pasa a tarjeta redondeada**

Reemplazar:

```tsx
    <div className="reveal mb-6 flex items-center justify-between gap-3 border-2 border-acid bg-surface px-4 py-3">
```

Por:

```tsx
    <div className="reveal mb-6 flex items-center justify-between gap-3 rounded-card border border-acid bg-surface px-4 py-3">
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/MuscleBody/MuscleBody.tsx src/components/react/InstallPrompt/InstallPrompt.tsx
git commit -m "style: round MuscleBody and InstallPrompt containers"
```

---

### Task 13: `src/pages/index.astro`

**Files:**
- Modify: `src/pages/index.astro:25,51,55`

- [ ] **Step 1: Divisor de sección — solo línea**

Reemplazar:

```astro
  <section class="border-b-2 border-paper-dim/30 pb-12">
```

Por:

```astro
  <section class="border-b border-paper-dim/30 pb-12">
```

- [ ] **Step 2: Grilla de 3 columnas del hero — caja contenedora, pasa a tarjeta redondeada**

Reemplazar:

```astro
  <section class="mt-12 grid gap-px overflow-hidden border-2 border-paper-dim/30 sm:grid-cols-3">
```

Por:

```astro
  <section class="mt-12 grid gap-px overflow-hidden rounded-card border border-paper-dim/30 sm:grid-cols-3">
```

- [ ] **Step 3: Divisores entre columnas de esa grilla — solo línea**

Reemplazar:

```astro
          class="reveal border-paper-dim/30 bg-surface p-6 sm:border-l-2 sm:first:border-l-0"
```

Por:

```astro
          class="reveal border-paper-dim/30 bg-surface p-6 sm:border-l sm:first:border-l-0"
```

- [ ] **Step 4: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "style: apply brutal-glass treatment to homepage hero"
```

---

### Task 14: Verificación final de build/tipos

**Files:** ninguno (solo verificación, sin cambios de código)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de Astro/Tailwind.

- [ ] **Step 2: Chequeo de tipos completo**

Run: `npx tsc --noEmit`
Expected: exactamente el mismo único error preexistente de `ProgressList.tsx` que existía antes de este plan (confirmable con `git stash` si hay dudas), y ningún otro.

- [ ] **Step 3: Grep de sanity check — no debe quedar ningún borde de 2px ni sombra offset dura en toda la app**

Run: `grep -rnE "border[a-z-]*-[0-9]+\b|shadow-\[[0-9]+px" src --include="*.tsx" --include="*.astro"`
Expected: sin resultados (si aparece algo, es un caso que se saltó en los Tasks 1-13 y hay que corregirlo antes de seguir).

- [ ] **Step 4: Grep de sanity check — no debe quedar ningún uso suelto del patrón viejo de "seleccionado" sin migrar a `pill-selected`/`fill-acid-on`**

Run: `grep -rn "border-acid bg-acid text-on-accent\|bg-acid text-on-accent" src --include="*.tsx" --include="*.astro"`
Expected: sin resultados (si aparece algo, es un caso que se saltó en los Tasks 2b, 3, 6, 7, 8b, 9 o 10 y hay que corregirlo antes de seguir).

- [ ] **Step 5: Commit (solo si los Steps 3/4 encontraron y corrigieron algo; si no, no hay nada que commitear en este task)**

---

### Task 15: Recorrido visual manual con Playwright

**Files:** ninguno (verificación manual, no produce cambios de código)

Este proyecto no tiene suite de tests automatizada (convención ya establecida) — el sustituto es un recorrido real con Playwright contra `npx astro preview` (no `astro dev`, que no sirve bien la PWA — ver `docs/agents/notas-de-entorno-y-lecciones.md`), en **ambos temas** (claro/oscuro, toggleable desde Perfil), sobre una cuenta de prueba reutilizable existente (ver `docs/agents/notas-de-entorno-y-lecciones.md` para reactivar una, ej. `crud-e2e-*@gmail.com`).

- [ ] **Step 1: Levantar el preview de producción**

Run: `npm run build && npx astro preview`

- [ ] **Step 2: Recorrer con Playwright, en modo oscuro, las pantallas: Nav (desktop y mobile), Rutinas, Registrar (con al menos un set logueado para ver la tabla), Progreso (con al menos una disciplina para ver `DisciplineSummary`), Perfil, login/registro/recuperar contraseña (para ver los mensajes de error con un submit inválido)**

Confirmar visualmente en cada una: sin sombras offset duras ni bordes de 2px en ningún lado, las tarjetas (`.card-brutal`) se ven con vidrio translúcido/blur, los botones primarios (`.btn-brutal`) tienen glow en vez de sombra dura, esquinas redondeadas consistentes en botones/tarjetas/inputs, y **ningún flujo funcional se rompió** (login, crear rutina, registrar set, editar perfil, borrar cuenta se probó aparte y no hace falta repetirlo acá — solo confirmar que los botones siguen respondiendo).

- [ ] **Step 3: Cambiar a modo claro desde Perfil y repetir el recorrido de las mismas pantallas**

Confirmar: las tarjetas ahora son sólidas y opacas (sin vidrio/blur), con sombra suave, mismo radio y tipografía que en oscuro.

- [ ] **Step 4: En Perfil, probar los 3 presets de degradado y el selector de color libre**

Confirmar por cada uno: (a) los 3 swatches de degradado (F1/F2/F3) están visibles junto a los 6 swatches sólidos y el selector de color libre — ninguno reemplazó a los otros; (b) al elegir F1/F2/F3, el botón "Guardar perfil", el nav activo, y los toggles de tema/unidad/sexo/nivel de esta misma pantalla muestran el degradado correspondiente (no un color liso); (c) al elegir F2 en particular, el texto sobre el relleno se ve blanco (no negro — es el único preset con `onAccent` claro); (d) al volver a elegir un color sólido del selector libre (los 6 swatches o el color picker nativo), todo vuelve a verse como un relleno liso, no un degradado; (e) recargar la página (F5) y confirmar que el acento elegido persiste (se aplica desde `localStorage` antes del primer paint, vía el script de `BaseLayout.astro`); (f) cerrar sesión, volver a entrar, y confirmar que el acento también persiste desde Supabase (`profile.accent_color`), no solo desde `localStorage` del mismo dispositivo.

- [ ] **Step 5: Si algo se ve mal o rompió algo, volver al task correspondiente, corregir, y repetir la verificación de ese task antes de continuar**

- [ ] **Step 6: Reportar a Pam el resultado del recorrido antes de ofrecer las opciones de la skill `finishing-a-development-branch`**

---

## Self-review de este plan

- **Cobertura del spec:** §1 (tokens) → Task 1. §2 (5 clases compartidas) → Task 2. §3 (tema claro) → Task 2 Step 5. §4 (excepciones: Nav/Avatar/MapPicker/CollapsibleSection) → Tasks 3-4. Los ~55 usos sueltos de `border-2`/variantes en los otros 25 archivos (encontrados con grep durante la planificación, más numerosos de lo que el spec había estimado — ya corregido con una nota en el spec) están cubiertos por los Tasks 5-13, aplicando el mismo criterio mecánico del spec ("el borde deja de ser el elemento que define la forma") de forma consistente en toda la app. §5 (qué no cambia) → respetado: ningún task toca estructura, lógica, copy o comportamiento, solo `className`/CSS/`theme.ts`. §Verificación → Tasks 14-15.
- **Cobertura del pedido de degradados (mid-flight, no estaba en el spec original):** 3 presets curados, F3 default, conviven con el color libre existente → Task 2b (`theme.ts`/`BaseLayout.astro`/schema) + fundación en Task 2 (`.pill-selected`/`.fill-acid-on`/`--gradient-acid`/glows con `color-mix()`) + UI nueva en Task 9 + barrido de los ~27 usos sueltos del patrón viejo en Tasks 3, 4, 6, 7, 8b, 9, 10 + sanity-check final en Task 14 Step 4 + verificación funcional (persistencia local y en Supabase) en Task 15 Step 4. Orden verificado: Task 2b corre antes que cualquier task que consuma sus exports (Task 9 es el único que importa de `theme.ts`), y las clases `.pill-selected`/`.fill-acid-on` quedan definidas desde el Task 2, antes de que el Task 3 (Nav) las use — ningún task queda referenciando algo que todavía no existe.
- **Placeholders:** ninguno — cada step muestra el string exacto actual y el string exacto nuevo.
- **Consistencia de nombres:** `rounded-card`/`rounded-control`/`pill-selected`/`fill-acid-on`/`--gradient-acid` se definen una sola vez cada uno (Tasks 1-2) y se usan igual en todos los tasks siguientes; no hay variantes de nombre. `ACCENT_GRADIENTS`/`AccentGradientId`/`DEFAULT_ACCENT` se definen en el Task 2b y Task 9 es el único otro lugar que los importa, con el mismo nombre.
