# Modernización visual "brutal-glass" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskinnear toda la UI de SelfGains a la dirección "brutal-glass" aprobada en `docs/superpowers/specs/2026-09-22-modernizacion-ui-brutal-glass-design.md` — esquinas redondeadas, vidrio translúcido con blur en oscuro, sólido sin blur en claro, sombras con glow en vez de offset duro, sin textura de ruido — sin tocar estructura, formularios, copy ni lógica.

**Architecture:** El 90% del área visual se resuelve editando 5 clases compartidas en `src/styles/global.css` (`.btn-brutal`, `.btn-brutal-outline`, `.btn-brutal-sm`, `.card-brutal`, `.input-brutal`) más dos tokens de radio nuevos en `@theme`. El resto son ~55 usos sueltos de `border-2`/`border-b-2`/`border-t-2`/`border-l-2`/`border-t-4` repartidos en 29 archivos que no pasan por esas clases — cada uno se corrige a mano con el mismo criterio mecánico: se quita el sufijo de ancho (queda el `border`/`border-t`/`border-b`/`border-l` default de 1px de Tailwind) y, únicamente en los que son cajas/botones (no líneas divisorias ni indicadores de 1 lado), se agrega `rounded-control` o `rounded-card`. Nunca se toca el color/opacidad de un borde existente, ni hover/active/disabled, ni ninguna lógica.

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

---

### Task 1: Tokens de radio + limpieza de textura de fondo

**Files:**
- Modify: `src/styles/global.css:1-20` (tokens), `src/styles/global.css:44-56` (fondo de `body`)

- [ ] **Step 1: Agregar los tokens de radio al `@theme`**

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
  /* Fixed dark color for text drawn on top of the (bright, user-chosen)
     accent fill — unlike ink/paper/surface this does NOT flip with the
     light/dark toggle, since accent fills stay bright in both themes. */
  --color-on-accent: #0c0c0a;

  /* Radios compartidos de la dirección "brutal-glass" (2026-09-22): --radius-X
     en @theme genera automáticamente la utilidad rounded-X, igual que ya pasa
     con --font-X y --color-X de arriba. */
  --radius-card: 16px;
  --radius-control: 10px;
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
      shadow-[0_6px_18px_-2px_rgba(215,255,63,0.35)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-4px_rgba(215,255,63,0.45)]
      active:translate-x-0 active:translate-y-0 active:shadow-none
      disabled:pointer-events-none disabled:opacity-40;
  }
```

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
      shadow-[0_4px_14px_-2px_rgba(215,255,63,0.25)] transition-transform duration-150
      hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(215,255,63,0.35)]
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

- [ ] **Step 4: Reescribir `.card-brutal` — vidrio translúcido con blur en oscuro, y agregar el override sólido de tema claro**

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
      shadow-[0_8px_30px_-14px_rgba(215,255,63,0.2)];
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

- [ ] **Step 5: Reescribir `.input-brutal` — borde 1px + radio, sin cambios de color/foco**

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

- [ ] **Step 6: Build completo (esto toca CSS usado en toda la app)**

Run: `npm run build`
Expected: build exitoso, sin errores de Tailwind (clases `rounded-card`/`rounded-control` deben resolver porque se generan automáticamente desde los tokens `--radius-card`/`--radius-control` agregados en el Task 1).

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css
git commit -m "style: rework shared brutal-* classes to brutal-glass (glow shadows, rounded corners, glass cards, solid light-theme cards)"
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

- [ ] **Step 2: Links del nav de escritorio — de caja de 2px a radio + borde fino**

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
                ? "border-acid bg-acid text-on-accent"
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

- [ ] **Step 4: Botón circular "Registrar" — borde 1px + glow (es el CTA principal, se lo trata como `.btn-brutal`)**

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
                "-mt-7 flex h-14 w-14 items-center justify-center rounded-full border border-acid shadow-[0_6px_18px_-2px_rgba(215,255,63,0.35)] transition-colors duration-150",
                isActive(link.href) ? "bg-acid text-on-accent" : "bg-ink text-acid",
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

Por:

```tsx
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-ink bg-acid font-display text-sm text-on-accent"
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

- [ ] **Step 1: `TrainerSearch.tsx` — botón chico, agrega radio**

Reemplazar:

```tsx
          className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
```

Por:

```tsx
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
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

- [ ] **Step 3: `PendingRoutineShares.tsx` — botón chico, agrega radio**

Reemplazar:

```tsx
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
```

Por:

```tsx
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
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

- [ ] **Step 1: `RoutineManager.tsx` — dos botones chicos + un mensaje de error**

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

### Task 9: `ProfileForm.tsx`

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx:346,356,604,606,617,626,631`

- [ ] **Step 1: Swatches de color de acento — ya son círculos, solo ancho**

Reemplazar:

```tsx
              className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${
```

Por:

```tsx
              className={`h-8 w-8 rounded-full border transition-transform duration-150 ${
```

- [ ] **Step 2: Trigger del selector de color nativo — control chico, agrega radio**

Reemplazar:

```tsx
            className="h-8 w-8 cursor-pointer border-2 border-paper-dim/40 bg-transparent p-0"
```

Por:

```tsx
            className="h-8 w-8 cursor-pointer rounded-control border border-paper-dim/40 bg-transparent p-0"
```

- [ ] **Step 3: Mensajes de error/guardado del formulario — solo línea**

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

- [ ] **Step 4: Botones "Cerrar sesión" y "Borrar cuenta" — agregan radio**

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

- [ ] **Step 5: Mensaje de error de borrado de cuenta — solo línea**

Reemplazar:

```tsx
        <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{deleteError}</p>
```

Por:

```tsx
        <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{deleteError}</p>
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit`
Expected: único error es el preexistente no relacionado de `ProgressList.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "style: apply brutal-glass treatment to ProfileForm"
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

- [ ] **Step 2: Botones de preset de peso — agrega radio, mantiene los dos estados condicionales**

Reemplazar:

```tsx
            className={`h-12 min-w-[4.5rem] flex-1 border-2 font-mono text-sm transition-colors ${
```

Por:

```tsx
            className={`h-12 min-w-[4.5rem] flex-1 rounded-control border font-mono text-sm transition-colors ${
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

- [ ] **Step 4: Barra de progreso — ya es `rounded-full`, solo ancho**

Reemplazar:

```tsx
              <div className="h-3 w-full overflow-hidden rounded-full border-2 border-paper-dim/30 bg-surface-raised">
```

Por:

```tsx
              <div className="h-3 w-full overflow-hidden rounded-full border border-paper-dim/30 bg-surface-raised">
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

- [ ] **Step 4: Commit (solo si el Step 3 encontró y corrigió algo; si no, no hay nada que commitear en este task)**

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

- [ ] **Step 4: Si algo se ve mal o rompió algo, volver al task correspondiente, corregir, y repetir la verificación del Step 6/7 de ese task antes de continuar**

- [ ] **Step 5: Reportar a Pam el resultado del recorrido antes de ofrecer las opciones de la skill `finishing-a-development-branch`**

---

## Self-review de este plan

- **Cobertura del spec:** §1 (tokens) → Task 1. §2 (5 clases compartidas) → Task 2. §3 (tema claro) → Task 2 Step 4. §4 (excepciones: Nav/Avatar/MapPicker/CollapsibleSection) → Tasks 3-4. Los ~55 usos sueltos de `border-2`/variantes en los otros 25 archivos (encontrados con grep durante la planificación, más numerosos de lo que el spec había estimado — ya corregido con una nota en el spec) están cubiertos por los Tasks 5-13, aplicando el mismo criterio mecánico del spec ("el borde deja de ser el elemento que define la forma") de forma consistente en toda la app. §5 (qué no cambia) → respetado: ningún task toca estructura, lógica, copy o comportamiento, solo `className`/CSS. §Verificación → Tasks 14-15.
- **Placeholders:** ninguno — cada step muestra el string exacto actual y el string exacto nuevo.
- **Consistencia de nombres:** `rounded-card`/`rounded-control` se definen una sola vez (Task 1) y se usan igual en todos los tasks siguientes; no hay variantes de nombre.
