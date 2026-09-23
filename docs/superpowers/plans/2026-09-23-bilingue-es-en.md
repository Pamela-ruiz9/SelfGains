# App bilingüe ES/EN — infraestructura + traducción de interfaz — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que toda la interfaz de SelfGains (nav, botones, formularios, mensajes) responda en español o inglés según ruteo (`/` = español, `/en/` = inglés), con selector de idioma en el Nav y en Perfil, persistencia dual (localStorage + Supabase), y detección de idioma del navegador en la primera visita. El contenido de ejercicios/rutinas queda en español en ambos idiomas — es la ronda 2, fuera de este plan.

**Architecture:** Ruteo i18n nativo de Astro (`astro:i18n`, sin librería externa). Diccionario propio en `src/i18n/{es,en}.ts` tipado de forma que `en.ts` debe cumplir exactamente la forma de `es.ts` (`en: Dictionary` donde `type Dictionary = typeof es`) — si falta una clave el build de TypeScript falla, así que no puede quedar un string sin traducir en silencio. Cada página `.astro` calcula su propio locale vía `Astro.currentLocale` (disponible en cualquier componente `.astro`, no solo en la página de nivel superior) y arma `const t = getDictionary(locale).<namespace>`, usando ese texto directo en su propio markup y pasando la porción que corresponda como prop a los islands de React que renderiza (los islands de React no tienen acceso a `Astro.currentLocale` porque corren en el cliente). Las páginas en inglés bajo `src/pages/en/*.astro` son copias literales byte-por-byte de sus páginas en español — como toda página ya autocalcula su locale desde `Astro.currentLocale`, que Astro deriva automáticamente de la carpeta de ruteo (`src/pages/en/...` → `currentLocale === "en"`), no hace falta ni una línea distinta entre el archivo español y su espejo en inglés. Esto simplifica bastante la Tarea 16 respecto de lo que sugería el diseño original (no hace falta "parametrizar" nada, es copiar el archivo).

**Tech Stack:** Astro 5 (`astro:i18n`), TypeScript, React 18 (islands), Tailwind CSS v4, Supabase (Postgres). Sin librería de i18n externa, sin Context de React — mismo patrón que ya usa la app para pasar datos de Astro a React.

---

## Cómo están organizadas las tareas

- **Tareas 1–6:** infraestructura pura (ruteo, diccionario base, Nav, BaseLayout, columna de Supabase, toggle de idioma en Perfil). Diffs exactos, línea por línea.
- **Tareas 7–15:** traducción de contenido de UI, agrupadas por pantalla/feature (17 páginas `.astro` restantes + 34 componentes React). Cada una sigue la misma metodología (ver más abajo) en vez de diffs pre-escritos para cada string — el mismo enfoque que ya se usó con éxito y pasó revisión rigurosa en la ronda de imágenes de ejercicios (`docs/superpowers/plans/2026-09-23-imagenes-ejercicios.md`, Tareas 4–5: metodología + ejemplo resuelto + criterio de verificación, no un diff línea por línea de cada archivo de contenido). Intentar pre-escribir el diff exacto de 34 componentes sin haberlos leído todos en esta sesión de planificación sería tanto inviable como propenso a error — la metodología, en cambio, es verificable por cualquier ingeniero que la siga.
- **Tarea 16:** páginas espejo en inglés — mecánica, un ejemplo completo + lista de los 13 archivos.
- **Tarea 17:** verificación final de todo el branch.

### Metodología para las tareas de traducción (7–15)

Para cada tarea de este grupo, el ingeniero debe:

1. **Leer el/los archivo(s) `.astro` y `.tsx` en el alcance de la tarea**, completos, no solo un fragmento.
2. **Extraer cada string de UI visible** (labels, botones, placeholders, mensajes de error/éxito, aria-labels, textos de estado vacío, títulos de `<BaseLayout title="...">`). No traducir: nombres de ejercicios/rutinas que vienen del content collection (fuera de esta ronda), ni strings que son claves técnicas (ids, nombres de campos de Supabase).
3. **Agregar un namespace nuevo a `src/i18n/es.ts` y `src/i18n/en.ts` simultáneamente** (mismo objeto, mismas claves, ambos archivos en el mismo commit) con esos strings — español literal tal cual está hoy en el código (no reescribir tono/voseo, es una extracción, no una reescritura), e inglés como traducción natural equivalente.
4. **Reemplazar cada string hardcodeado** en el archivo `.astro`/`.tsx` por la referencia al diccionario (`t.claveDelString`), calculando `t` con `getDictionary(locale)` en el archivo `.astro` (usando `Astro.currentLocale`), y pasándolo como prop tipado a cada island de React que lo necesite.
5. **Verificar:** `npx tsc --noEmit` limpio (si falta una clave en `en.ts`, TypeScript lo marca) y `npm run build` limpio. Grep del/los archivo(s) modificados para confirmar que no quedó ningún string en español fuera del diccionario (más allá del contenido de ejercicios/rutinas, que es intencional).

Cada tarea de este grupo indica: archivos en alcance, nombre del namespace a crear, y — cuando el archivo ya fue leído durante la planificación — un ejemplo resuelto completo para calibrar el criterio.

---

## Tarea 1: Ruteo i18n (`astro.config.mjs`)

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Agregar el bloque `i18n`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://Pamela-ruiz9.github.io',
  base: '/SelfGains/',
  output: 'static',
  integrations: [react()],
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 2: Verificar que el build sigue limpio (todavía no hay páginas en `/en/`, así que no debe cambiar nada visible)**

Run: `npm run build`
Expected: build exitoso, mismo output que antes (el `i18n` config no genera páginas nuevas por sí solo, solo habilita `Astro.currentLocale` / `astro:i18n` para cuando existan).

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat: habilitar ruteo i18n de Astro (es sin prefijo, en bajo /en/)"
```

---

## Tarea 2: Diccionario base (`src/i18n/`)

**Files:**
- Create: `src/i18n/es.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/index.ts`

- [ ] **Step 1: Crear `src/i18n/es.ts` con el namespace `nav`**

```ts
export const es = {
  nav: {
    ejercicios: 'Ejercicios',
    rutinas: 'Rutinas',
    registrar: 'Registrar',
    progreso: 'Progreso',
    perfil: 'Perfil',
    switchToEnglish: 'Cambiar a inglés',
    switchToSpanish: 'Cambiar a español',
  },
} as const;

export type Dictionary = typeof es;
```

- [ ] **Step 2: Crear `src/i18n/en.ts`**

```ts
import type { Dictionary } from './es';

export const en: Dictionary = {
  nav: {
    ejercicios: 'Exercises',
    rutinas: 'Routines',
    registrar: 'Log',
    progreso: 'Progress',
    perfil: 'Profile',
    switchToEnglish: 'Switch to English',
    switchToSpanish: 'Switch to Spanish',
  },
};
```

- [ ] **Step 3: Crear `src/i18n/index.ts`**

```ts
import { es } from './es';
import { en } from './en';
import type { Dictionary } from './es';

export type { Dictionary };

export function getDictionary(locale: string | undefined): Dictionary {
  return locale === 'en' ? en : es;
}

// Arma un href para "path" (relativo, sin barra inicial, ej. "rutinas/") en
// el locale dado. Español no lleva prefijo (prefixDefaultLocale: false),
// inglés vive bajo "/en/".
export function localePath(locale: string, base: string, path: string): string {
  return locale === 'en' ? `${base}en/${path}` : `${base}${path}`;
}

// Dado el pathname actual completo (con base incluido, ej.
// "/SelfGains/en/rutinas/"), arma el path a la misma pantalla en el otro
// idioma — usado por el selector de idioma para no perder la pantalla
// actual al cambiar de locale.
export function otherLocaleHref(pathname: string, base: string): string {
  const isEnglish = pathname.startsWith(`${base}en/`);
  const neutral = isEnglish ? pathname.slice(`${base}en/`.length) : pathname.slice(base.length);
  return isEnglish ? `${base}${neutral}` : `${base}en/${neutral}`;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio. Si `en.ts` le faltara una clave de `nav`, este comando falla con un error de tipo señalando la clave faltante — ese es el mecanismo central de todo el plan, vale la pena confirmarlo ahora a propósito borrando una clave de `en.ts` temporalmente, corriendo el comando, viendo el error, y restaurándola.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat: agregar infraestructura de diccionario i18n (es/en) con namespace nav"
```

---

## Tarea 3: Selector de idioma + traducción de labels en `Nav.astro`

**Files:**
- Modify: `src/components/astro/Nav.astro`

**Contenido actual completo (para referencia — no repetir, ya está en el repo):** el archivo arma `base`, `path`, un array `links` con 5 entradas hardcodeadas en español, una función `isActive`, íconos SVG inline, un header desktop (`hidden ... sm:flex`) que muestra `links` como pills, un nav mobile fijo abajo con 5 columnas (el del medio es el CTA circular de "Registrar"), y un `<script>` final que inyecta el avatar del usuario en los íconos de perfil.

- [ ] **Step 1: Importar el diccionario y calcular `locale`/`t`/`otherHref` en el frontmatter**

Reemplazar las líneas 1–11 (desde `---` hasta el cierre del array `links`) por:

```astro
---
import { getDictionary, localePath, otherLocaleHref } from "../../i18n";

const base = import.meta.env.BASE_URL;
const path = Astro.url.pathname;
const locale = Astro.currentLocale === "en" ? "en" : "es";
const t = getDictionary(locale).nav;
const otherHref = otherLocaleHref(path, base);

const links = [
  { id: "ejercicios", href: localePath(locale, base, "ejercicios/"), label: t.ejercicios },
  { id: "rutinas", href: localePath(locale, base, "rutinas/"), label: t.rutinas },
  { id: "registrar", href: localePath(locale, base, "registro/nuevo/"), label: t.registrar },
  { id: "progreso", href: localePath(locale, base, "progreso/"), label: t.progreso },
  { id: "perfil", href: localePath(locale, base, "perfil/"), label: t.perfil },
];
```

El resto del frontmatter (`isActive`, `ICONS`, `iconSvg`) queda igual, sin cambios.

- [ ] **Step 2: Logo — que respete el locale actual al volver al home**

Cambiar:
```astro
<a href={base} class="group flex items-center gap-2">
```
por:
```astro
<a href={locale === "en" ? `${base}en/` : base} class="group flex items-center gap-2">
```

- [ ] **Step 3: Agregar el toggle de idioma junto a los links del header desktop**

El markup actual tiene, dentro de `<nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">`, al logo seguido directo de:
```astro
<div class="hidden items-center gap-2 font-mono text-sm uppercase tracking-[0.15em] sm:flex">
  {links.map((link) => ( ... ))}
</div>
```

Envolver ese `<div>` y agregar el pill de idioma como hermano, dentro de un wrapper nuevo (así `justify-between` sigue poniendo [logo] vs [links + idioma] en extremos opuestos, y el pill queda visible también en mobile porque el wrapper nuevo NO tiene `hidden`/`sm:flex`, a diferencia del div de links):

```astro
<div class="flex items-center gap-3">
  <div class="hidden items-center gap-2 font-mono text-sm uppercase tracking-[0.15em] sm:flex">
    {
      links.map((link) => (
        <a
          href={link.href}
          class:list={[
            "flex items-center gap-2 rounded-control border px-3 py-2 transition-colors duration-150",
            isActive(link.href)
              ? "pill-selected"
              : "border-transparent text-paper hover:border-paper-dim/50 hover:text-acid",
          ]}
        >
          <span
            class:list={["h-4 w-4 shrink-0", link.id === "perfil" && "overflow-hidden rounded-full"]}
            data-nav-avatar={link.id === "perfil" ? "true" : undefined}
            set:html={iconSvg(link.id)}
          />
          {link.label}
        </a>
      ))
    }
  </div>
  <a
    href={otherHref}
    aria-label={locale === "en" ? t.switchToSpanish : t.switchToEnglish}
    class="flex items-center overflow-hidden rounded-full border border-paper-dim/40 font-mono text-[10px] uppercase tracking-wide"
  >
    <span class:list={["px-2 py-1", locale === "es" ? "pill-selected" : "text-paper-dim"]}>ES</span>
    <span class:list={["px-2 py-1", locale === "en" ? "pill-selected" : "text-paper-dim"]}>EN</span>
  </a>
</div>
```

Nota: el `{links.map(...)}` de este paso es literal, mismo JSX que ya existe hoy — solo se mueve un nivel adentro del nuevo wrapper. No cambiar su contenido interno.

- [ ] **Step 4: Verificar visualmente**

Run: `npm run build && npx astro preview` (o `npm run dev`)

Con Playwright (skill `superpowers:webapp-testing`): navegar `/SelfGains/`, confirmar que el pill ES/EN aparece en el header tanto en viewport desktop como mobile (viewport angosto, ej. 390px), que "ES" está resaltado con `pill-selected`, y que al hacer click navega a `/SelfGains/en/` (aunque esa ruta todavía no exista como página real hasta la Tarea 16 — está bien que dé 404 por ahora, lo importante es confirmar que el `href` calculado es el correcto; inspeccionar el DOM con Playwright en vez de navegar si preferís no depender del 404).

- [ ] **Step 5: Commit**

```bash
git add src/components/astro/Nav.astro
git commit -m "feat: agregar selector de idioma y traducir labels del Nav"
```

---

## Tarea 4: Detección de idioma + `<html lang>` dinámico (`BaseLayout.astro`)

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: `<html lang>` dinámico**

Cambiar línea 14:
```astro
<html lang="es">
```
por:
```astro
<html lang={Astro.currentLocale === "en" ? "en" : "es"}>
```

- [ ] **Step 2: Agregar el script de detección de primera visita, antes del script de tema existente**

Insertar este bloque nuevo inmediatamente antes de `<script is:inline>` (el que empieza con `(function () { // Duplica ACCENT_GRADIENTS...`), dentro de `<head>`:

```astro
    <script is:inline define:vars={{ base }}>
      (function () {
        // Corre en cada carga de página, pero es un no-op apenas existe una
        // preferencia guardada — "primera visita" acá significa
        // literalmente "todavía no eligió ni se le detectó un idioma",
        // nunca vuelve a mirar el navegador después de la primera vez
        // (ver docs/superpowers/specs/2026-09-23-bilingue-es-en-design.md, sección 4).
        try {
          var STORAGE_KEY = 'selfgains-locale';
          if (localStorage.getItem(STORAGE_KEY)) return;
          var browserLang = (navigator.language || '').toLowerCase();
          var wantsEnglish = browserLang.indexOf('en') === 0;
          localStorage.setItem(STORAGE_KEY, wantsEnglish ? 'en' : 'es');
          var path = window.location.pathname;
          var isEnglishPath = path.indexOf(base + 'en/') === 0;
          if (wantsEnglish && !isEnglishPath) {
            window.location.replace(base + 'en/' + path.slice(base.length));
          }
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: build limpio.

Con Playwright: limpiar `localStorage` antes de navegar, configurar el contexto del browser con `locale='en-US'` (`browser.new_context(locale='en-US')` en Playwright), navegar a `/SelfGains/`, confirmar que redirige a `/SelfGains/en/` (dará 404 hasta la Tarea 16, pero la URL final después del redirect debe ser esa — verificar `page.url` después de `page.goto` con `wait_until='commit'` o revisando el header `Location` antes de que la 404 cargue, o simplemente verificar contra `/SelfGains/rutinas/` que sí existe hoy para no depender de páginas que aún no existen). Repetir con `locale='es-ES'` y confirmar que NO redirige. Repetir una tercera vez con `locale='en-US'` pero con `selfgains-locale` ya seteado en `localStorage` a `'es'` antes de navegar, y confirmar que esta vez NO redirige (la preferencia guardada gana sobre el navegador).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: detectar idioma del navegador en la primera visita y setear html lang dinámico"
```

---

## Tarea 5: Columna `locale` en Supabase + tipo `Profile`

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Agregar la columna a `profiles`**

Agregar al final de `supabase/schema.sql` (después de la última línea, `grant execute on function delete_own_account() to authenticated;`):

```sql

-- Idioma bilingüe ES/EN (2026-09-23) — infraestructura i18n
-- (docs/superpowers/specs/2026-09-23-bilingue-es-en-design.md). Mismo
-- patrón dual que theme/accent_color: local (localStorage) para el primer
-- paint sin sesión, esta columna como fuente de verdad entre dispositivos
-- una vez que hay sesión. Default 'es' porque toda la app ya es en
-- español hoy — ningún perfil existente cambia de idioma con este ALTER.
alter table profiles add column locale text not null default 'es' check (locale in ('es', 'en'));
```

- [ ] **Step 2: Correr la migración en Supabase**

Este proyecto no tiene CLI de migraciones automatizado (convención ya establecida en `supabase/schema.sql` — cada ALTER se corre a mano en el SQL Editor del dashboard de Supabase). Pegar y ejecutar el bloque del Step 1 en el SQL Editor del proyecto de Supabase.

- [ ] **Step 3: Agregar el campo al tipo `Profile`**

En `src/types/db.ts`, dentro de `export interface Profile { ... }`, agregar `locale: 'es' | 'en';` inmediatamente después de `theme: 'light' | 'dark';`:

```ts
  theme: 'light' | 'dark';
  locale: 'es' | 'en';
```

No hace falta tocar `src/lib/profile.ts` — `upsertProfile` ya es un upsert parcial genérico (`upsertProfile({ locale: 'en' })` funciona sin cambios), y `getMyProfile` selecciona `*`, así que trae la columna nueva automáticamente.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio (ningún código existente desestructura `Profile` de forma exhaustiva que rompa con un campo nuevo).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/types/db.ts
git commit -m "feat: agregar columna locale a profiles y al tipo Profile"
```

---

## Tarea 6: Toggle de idioma en Perfil (`ProfileForm.tsx`)

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx`

Esta tarea agrega la superficie de Perfil del selector de idioma (mockup opción C, sección "Idioma" junto a "Apariencia"). La traducción del resto de los textos de `ProfileForm.tsx` (incluida esta sección nueva) es la Tarea 9 — acá el label se deja en español literal a propósito, consistente con que el resto del archivo sigue sin traducir hasta la Tarea 9.

- [ ] **Step 1: Agregar el estado `locale`**

En la lista de `useState` (después de `const [theme, setTheme] = useState<ThemeMode>('dark');`), agregar:

```tsx
  const [locale, setLocale] = useState<'es' | 'en'>('es');
```

- [ ] **Step 2: Cargar el valor del perfil**

En el `useEffect` de carga, donde ya está `setTheme(profile.theme);`, agregar justo debajo:

```tsx
        setLocale(profile.locale);
```

- [ ] **Step 3: Agregar el handler**

Después de `handleThemeChange`, agregar una función nueva:

```tsx
  async function handleLocaleChange(next: 'es' | 'en') {
    setLocale(next);
    try {
      localStorage.setItem('selfgains-locale', next);
    } catch {}
    try {
      await upsertProfile({ locale: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el idioma.');
    }
    const base = import.meta.env.BASE_URL;
    window.location.href = next === 'en' ? `${base}en/perfil/` : `${base}perfil/`;
  }
```

`ProfileForm` solo se renderiza en la página Perfil (`/perfil/` o, después de la Tarea 16, `/en/perfil/`), así que no hace falta el cálculo genérico de "misma página en el otro idioma" acá — siempre es la misma página, Perfil.

- [ ] **Step 4: Agregar la sección "Idioma" en el JSX, antes de "Apariencia"**

Insertar inmediatamente antes de `<div className="flex flex-col gap-3">\n  <p className="label-brutal text-acid">Apariencia</p>`:

```tsx
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Idioma</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleLocaleChange('es')}
            className={locale === 'es' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            Español
          </button>
          <button
            type="button"
            onClick={() => handleLocaleChange('en')}
            className={locale === 'en' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            English
          </button>
        </div>
      </div>

```

- [ ] **Step 5: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios.

Con Playwright: loguearse (o usar una sesión ya autenticada de prueba), ir a `/SelfGains/perfil/`, confirmar que aparece la sección "Idioma" con "Español" resaltado, click en "English", confirmar navegación a `/SelfGains/en/perfil/` (dará 404 hasta la Tarea 16 — confirmar al menos que la URL de destino es la esperada) y que `localStorage.selfgains-locale === 'en'` después del click.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "feat: agregar selector de idioma en Perfil"
```

---

## Tarea 7: Traducción — Auth (login, registro, recuperar/restablecer contraseña)

**Files en alcance:**
- Modify: `src/pages/login.astro`
- Modify: `src/components/react/Auth/LoginForm.tsx`
- Modify: `src/pages/registro-cuenta.astro`
- Modify: `src/components/react/Auth/SignupForm.tsx`
- Modify: `src/pages/olvide-contrasena.astro`
- Modify: `src/components/react/Auth/ForgotPasswordForm.tsx`
- Modify: `src/pages/restablecer-contrasena.astro`
- Modify: `src/components/react/Auth/ResetPasswordForm.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `auth`, con un sub-objeto por pantalla (`auth.login`, `auth.signup`, `auth.forgotPassword`, `auth.resetPassword`).

**Ejemplo resuelto — `login.astro` + `LoginForm.tsx` (aplicar el mismo patrón a las otras 3 pantallas, leyendo cada archivo primero):**

- [ ] **Step 1: Agregar `auth.login` a ambos diccionarios**

En `src/i18n/es.ts`, agregar dentro del objeto `es`, como hermano de `nav`:

```ts
  auth: {
    login: {
      pageTitle: 'Iniciar sesión',
      welcomeBack: 'Bienvenido de vuelta',
      heading: 'INICIAR SESIÓN',
      noAccount: '¿No tienes cuenta?',
      createOne: 'Crea una',
      forgotPassword: '¿Olvidaste tu contraseña?',
      continueWithGoogle: 'Continuar con Google',
      or: 'O',
      email: 'Email',
      password: 'Contraseña',
      submit: 'Entrar',
      submitting: 'Entrando...',
    },
  },
```

En `src/i18n/en.ts`, dentro del objeto `en`, como hermano de `nav`:

```ts
  auth: {
    login: {
      pageTitle: 'Log in',
      welcomeBack: 'Welcome back',
      heading: 'LOG IN',
      noAccount: "Don't have an account?",
      createOne: 'Create one',
      forgotPassword: 'Forgot your password?',
      continueWithGoogle: 'Continue with Google',
      or: 'OR',
      email: 'Email',
      password: 'Password',
      submit: 'Log in',
      submitting: 'Logging in...',
    },
  },
```

(Las otras 3 pantallas de este grupo agregan sus propias claves `signup`, `forgotPassword`, `resetPassword` dentro del mismo `auth`, mismo nivel que `login` — leer cada archivo `.astro`/`.tsx` para extraer sus strings reales antes de inventar la forma del objeto.)

- [ ] **Step 2: Reescribir `login.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import LoginForm from '../components/react/Auth/LoginForm';
import { getDictionary } from '../i18n';

const base = import.meta.env.BASE_URL;
const locale = Astro.currentLocale === 'en' ? 'en' : 'es';
const t = getDictionary(locale).auth.login;
---
<BaseLayout title={t.pageTitle}>
  <p class="label-brutal mb-3 text-acid">{t.welcomeBack}</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">{t.heading}</h1>
  <LoginForm client:load t={t} />
  <p class="mt-6 flex flex-col gap-2 font-mono text-sm text-paper-dim">
    <span>
      {t.noAccount}
      <a href={`${base}registro-cuenta/`} class="text-acid underline underline-offset-4 hover:text-paper">
        {t.createOne}
      </a>
    </span>
    <a href={`${base}olvide-contrasena/`} class="text-acid underline underline-offset-4 hover:text-paper">
      {t.forgotPassword}
    </a>
  </p>
</BaseLayout>
```

Nota: los `href` de este archivo (`registro-cuenta/`, `olvide-contrasena/`) quedan sin prefijo de locale a propósito en esta tarea — se corrigen en la Tarea 16 cuando existan las páginas espejo, usando el mismo patrón `localePath` de la Tarea 3 si hace falta, o quedan igual si se resuelve que un link cruzado entre pantallas de auth puede aterrizar en español y desde ahí el usuario ya tiene el toggle del Nav disponible. Decisión del ingeniero que ejecute la tarea, documentarla en el commit si se aparta de "quedan sin prefijo".

- [ ] **Step 3: Reescribir `LoginForm.tsx` para recibir y usar `t`**

Cambiar la firma del componente y usar `t` en vez de los strings hardcodeados:

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Dictionary } from '../../../i18n';

export default function LoginForm({ t }: { t: Dictionary['auth']['login'] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = `${import.meta.env.BASE_URL}registro/nuevo/`;
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}registro/nuevo/` },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-5">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="btn-brutal-outline flex items-center justify-center gap-3"
      >
        <GoogleIcon />
        {t.continueWithGoogle}
      </button>
      <div className="flex items-center gap-3 text-paper-dim">
        <div className="h-px flex-1 bg-paper-dim/30" />
        <span className="font-mono text-xs">{t.or}</span>
        <div className="h-px flex-1 bg-paper-dim/30" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="label-brutal">{t.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            required
            autoComplete="email"
            disabled={loading}
            className="input-brutal"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-brutal">{t.password}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            required
            minLength={6}
            autoComplete="current-password"
            disabled={loading}
            className="input-brutal"
          />
        </label>
        {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        <button type="submit" disabled={loading} className="btn-brutal">
          {loading ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
```

Nota: el error de Supabase (`error.message`) queda sin traducir — viene en inglés directo de la API de Supabase, traducirlo requeriría mapear códigos de error a mano, está fuera de alcance de esta ronda (no estaba en el spec).

- [ ] **Step 4: Aplicar el mismo patrón a `registro-cuenta.astro`/`SignupForm.tsx`, `olvide-contrasena.astro`/`ForgotPasswordForm.tsx`, `restablecer-contrasena.astro`/`ResetPasswordForm.tsx`**

Para cada par: leer los dos archivos completos, extraer sus strings reales, agregar `auth.signup` / `auth.forgotPassword` / `auth.resetPassword` a ambos diccionarios con esos strings (español literal + traducción al inglés), pasar `t` como prop igual que en el Step 3.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos limpios.

`grep -n "Bienvenido\|Contraseña\|Iniciar sesión\|Registrarse\|contraseña" src/pages/login.astro src/pages/registro-cuenta.astro src/pages/olvide-contrasena.astro src/pages/restablecer-contrasena.astro src/components/react/Auth/*.tsx` — no debe matchear nada fuera de comentarios o de `src/i18n/es.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/login.astro src/pages/registro-cuenta.astro src/pages/olvide-contrasena.astro src/pages/restablecer-contrasena.astro src/components/react/Auth/ src/i18n/
git commit -m "feat: traducir pantallas de autenticación (login, registro, recuperar/restablecer contraseña)"
```

---

## Tarea 8: Traducción — Home (`index.astro`)

**Files en alcance:**
- Modify: `src/pages/index.astro`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `home`.

- [ ] **Step 1: Agregar `home` a ambos diccionarios**

`src/i18n/es.ts`:
```ts
  home: {
    pageTitle: 'Inicio',
    eyebrow: 'Entrena. Registra. Progresa.',
    headingLine1: 'TU MEJOR',
    headingLine2: 'VERSIÓN,',
    headingLine3Acid1: 'SERIE',
    headingLine3Middle: 'POR',
    headingLine3Acid2: 'SERIE.',
    subtitle:
      'SelfGains combina guías para principiantes, seguimiento de hábitos y un cuaderno de entrenamiento real — series, reps, peso y RPE — en un solo lugar.',
    ctaLog: 'Registrar entrenamiento',
    ctaProgress: 'Ver progreso',
    pillars: [
      {
        n: '01',
        title: 'Aprender a entrenar',
        body: 'Guías y planes predefinidos para principiantes. Sin adivinar qué hacer en el gimnasio.',
      },
      {
        n: '02',
        title: 'Construir un mejor yo',
        body: 'Progreso general, hábitos, motivación. El entrenamiento como parte de algo más grande.',
      },
      {
        n: '03',
        title: 'Registro de entrenamientos',
        body: 'Series, reps, peso, progresión, PRs. Datos reales de lo que de verdad levantaste.',
      },
    ],
  },
```

`src/i18n/en.ts`:
```ts
  home: {
    pageTitle: 'Home',
    eyebrow: 'Train. Log. Progress.',
    headingLine1: 'YOUR BEST',
    headingLine2: 'VERSION,',
    headingLine3Acid1: 'SET',
    headingLine3Middle: 'BY',
    headingLine3Acid2: 'SET.',
    subtitle:
      'SelfGains combines beginner guides, habit tracking, and a real training log — sets, reps, weight, and RPE — in one place.',
    ctaLog: 'Log a workout',
    ctaProgress: 'See progress',
    pillars: [
      {
        n: '01',
        title: 'Learn to train',
        body: 'Guides and ready-made plans for beginners. No guessing what to do at the gym.',
      },
      {
        n: '02',
        title: 'Build a better you',
        body: 'Overall progress, habits, motivation. Training as part of something bigger.',
      },
      {
        n: '03',
        title: 'Workout logging',
        body: 'Sets, reps, weight, progression, PRs. Real data on what you actually lifted.',
      },
    ],
  },
```

- [ ] **Step 2: Reescribir `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getDictionary } from '../i18n';

const base = import.meta.env.BASE_URL;
const locale = Astro.currentLocale === 'en' ? 'en' : 'es';
const t = getDictionary(locale).home;
---
<BaseLayout title={t.pageTitle}>
  <section class="border-b border-paper-dim/30 pb-12">
    <p class="reveal label-brutal mb-4 text-acid">{t.eyebrow}</p>
    <h1
      class="reveal font-display text-6xl leading-[0.95] text-paper sm:text-8xl"
      style="animation-delay: 60ms"
    >
      {t.headingLine1}<br />
      {t.headingLine2}<br />
      <span class="text-acid">{t.headingLine3Acid1}</span> {t.headingLine3Middle} <span class="text-acid">{t.headingLine3Acid2}</span>
    </h1>
    <p
      class="reveal mt-6 max-w-xl font-body text-lg text-paper-dim"
      style="animation-delay: 140ms"
    >
      {t.subtitle}
    </p>
    <div class="reveal mt-8 flex flex-wrap gap-4" style="animation-delay: 200ms">
      <a href={`${base}registro/nuevo/`} class="btn-brutal">
        {t.ctaLog}
      </a>
      <a href={`${base}progreso/`} class="btn-brutal-outline"> {t.ctaProgress} </a>
    </div>
  </section>

  <section class="mt-12 grid gap-px overflow-hidden rounded-card border border-paper-dim/30 sm:grid-cols-3">
    {
      t.pillars.map((p, i) => (
        <div
          class="reveal border-paper-dim/30 bg-surface p-6 sm:border-l sm:first:border-l-0"
          style={`animation-delay: ${260 + i * 90}ms`}
        >
          <span class="font-mono text-sm text-acid">{p.n}</span>
          <h2 class="mt-2 font-display text-2xl tracking-wide text-paper">{p.title}</h2>
          <p class="mt-2 font-body text-sm text-paper-dim">{p.body}</p>
        </div>
      ))
    }
  </section>
</BaseLayout>
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos limpios.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/i18n/
git commit -m "feat: traducir la pantalla de inicio"
```

---

## Tarea 9: Traducción — Perfil (`perfil.astro` + `ProfileForm.tsx`)

**Files en alcance:**
- Modify: `src/pages/perfil.astro`
- Modify: `src/components/react/Profile/ProfileForm.tsx` (incluye la sección "Idioma"/"Apariencia" agregada en la Tarea 6, que quedó en español literal a propósito)
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `perfil`. Es el archivo React más grande del proyecto (foto, medidas corporales, tema/idioma, unidad de peso, sexo/nivel, sección de entrenador, borrar cuenta) — seguir la metodología general (leer completo, extraer cada string, incluidos los mensajes de error de cada `catch` y los `aria-label`), sin ejemplo resuelto acá dado el tamaño del archivo. Prestar atención especial a `MEASUREMENT_FIELDS` (array con `label` por campo) y a los mensajes de error dentro de cada `try/catch`, que son fáciles de pasar por alto porque no están en el JSX principal.

- [ ] **Step 1: Leer `src/pages/perfil.astro` y `src/components/react/Profile/ProfileForm.tsx` completos**

- [ ] **Step 2: Agregar el namespace `perfil` a ambos diccionarios** con todos los strings extraídos (labels, botones, placeholders, mensajes de error/éxito, aria-labels, `MEASUREMENT_FIELDS`, textos de la sección de entrenador y de borrar cuenta)

- [ ] **Step 3: Reemplazar cada string en `perfil.astro` por `t.claveDelString`**, calculando `t` vía `getDictionary(locale).perfil` con `Astro.currentLocale`, y pasarlo como prop a `<ProfileForm client:load t={t} />`

- [ ] **Step 4: Reemplazar cada string en `ProfileForm.tsx`** por referencias a `t` (prop nueva, tipada `Dictionary['perfil']`), incluida la sección "Idioma"/"Apariencia" de la Tarea 6

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run build`

Con Playwright: loguearse, ir a `/SelfGains/perfil/`, confirmar visualmente que no queda ningún texto en español fuera de los valores que el propio usuario cargó (nombre, medidas).

- [ ] **Step 6: Commit**

```bash
git add src/pages/perfil.astro src/components/react/Profile/ProfileForm.tsx src/i18n/
git commit -m "feat: traducir la pantalla de Perfil"
```

---

## Tarea 10: Traducción — Ejercicios (`ejercicios/index.astro`, `MuscleExplorer.tsx`, `MuscleBody.tsx`)

**Files en alcance:**
- Modify: `src/pages/ejercicios/index.astro`
- Modify: `src/components/react/MuscleExplorer/MuscleExplorer.tsx`
- Modify: `src/components/react/MuscleBody/MuscleBody.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `ejercicios`.

**Importante — qué NO traducir acá:** los nombres de músculos/grupos y de ejercicios individuales vienen del content collection (`getCollection('activities')`, campo `discipline`/`group`/`name`) — eso es contenido, ronda 2, se deja en español. Esta tarea traduce únicamente el "chrome" de la pantalla: título de página, labels de filtros, placeholder de búsqueda, textos de estado vacío, botones.

- [ ] **Step 1: Leer los 3 archivos completos**, identificando con cuidado qué texto es UI estática (traducir) vs. qué viene de `activities`/`e.data.*` (no traducir)

- [ ] **Step 2: Agregar el namespace `ejercicios` a ambos diccionarios**

- [ ] **Step 3: Reemplazar strings de UI estática por `t.claveDelString`** en los 3 archivos, pasando `t` desde `ejercicios/index.astro` como prop a `MuscleExplorer` (que a su vez se lo pasa a `MuscleBody` si corresponde)

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

`grep` sobre los 3 archivos para confirmar que los únicos strings en español que sobreviven son los que efectivamente vienen de variables de contenido (`{activity.name}`, `{group}`, etc.), no literales hardcodeados.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ejercicios/ src/components/react/MuscleExplorer/ src/components/react/MuscleBody/ src/i18n/
git commit -m "feat: traducir la pantalla de Ejercicios (chrome de UI, no nombres de ejercicios)"
```

---

## Tarea 11: Traducción — Rutinas (`rutinas/index.astro`, `RoutineManager/*.tsx`)

**Files en alcance:**
- Modify: `src/pages/rutinas/index.astro`
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx`
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`
- Modify: `src/components/react/RoutineManager/RoutinePreview.tsx`
- Modify: `src/components/react/RoutineManager/CreateRoutineForm.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `rutinas`. No traducir nombres/días/ejercicios de rutinas que vienen del content collection o que el usuario creó — solo el chrome (botones, labels de formulario, mensajes de estado, confirmaciones de compartir/eliminar).

- [ ] **Step 1: Leer los 5 archivos completos**

- [ ] **Step 2: Agregar el namespace `rutinas` a ambos diccionarios**, con sub-claves por componente si el volumen de strings lo justifica (ej. `rutinas.list`, `rutinas.preview`, `rutinas.create`) para mantener el objeto legible

- [ ] **Step 3: Reemplazar strings, pasando `t` desde la página hacia cada componente React que lo necesite**

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/pages/rutinas/ src/components/react/RoutineManager/ src/i18n/
git commit -m "feat: traducir la pantalla de Rutinas"
```

---

## Tarea 12: Traducción — Registrar entrenamiento (`registro/nuevo.astro`, `WorkoutLogger.tsx`, `ActivityPicker.tsx`)

**Files en alcance:**
- Modify: `src/pages/registro/nuevo.astro`
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`
- Modify: `src/components/react/ActivityPicker/ActivityPicker.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `registrar`. `registro/nuevo.astro` ya se leyó durante la planificación — su contenido completo es:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import InstallPrompt from '../../components/react/InstallPrompt/InstallPrompt';
import { getCollection } from 'astro:content';

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => ({ ... }))
  .sort((a, b) => a.name.localeCompare(b.name));

const planEntries = await getCollection('plans');
const plans = planEntries.map((p) => ({ id: p.id, days: p.data.days }));
---
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <p class="card-brutal mb-6 border-acid font-mono text-sm text-paper">
    Calienta siempre antes de entrenar — unos minutos de movilidad y activación reducen el riesgo de lesión.
  </p>
  <InstallPrompt client:load variant="banner" />
  <WorkoutLogger client:load activities={activities} plans={plans} />
</BaseLayout>
```

- [ ] **Step 1: Agregar `registrar` (para esta página) a ambos diccionarios**

`src/i18n/es.ts`:
```ts
  registrar: {
    pageTitle: 'Registrar entrenamiento',
    eyebrow: 'Sesión de hoy',
    heading: 'REGISTRAR ENTRENAMIENTO',
    warmupTip: 'Calienta siempre antes de entrenar — unos minutos de movilidad y activación reducen el riesgo de lesión.',
  },
```

`src/i18n/en.ts`:
```ts
  registrar: {
    pageTitle: 'Log workout',
    eyebrow: "Today's session",
    heading: 'LOG WORKOUT',
    warmupTip: 'Always warm up before training — a few minutes of mobility and activation reduce injury risk.',
  },
```

(`InstallPrompt` no forma parte del alcance de esta tarea — es la Tarea 15.)

- [ ] **Step 2: Reescribir `registro/nuevo.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import InstallPrompt from '../../components/react/InstallPrompt/InstallPrompt';
import { getCollection } from 'astro:content';
import { getDictionary } from '../../i18n';

const locale = Astro.currentLocale === 'en' ? 'en' : 'es';
const t = getDictionary(locale).registrar;

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
    group: e.data.metricType === 'session' ? e.data.group : undefined,
    image: e.data.metricType === 'sets' ? e.data.image : undefined,
    description: e.body?.trim() ?? '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const planEntries = await getCollection('plans');
const plans = planEntries.map((p) => ({ id: p.id, days: p.data.days }));
---
<BaseLayout title={t.pageTitle}>
  <p class="label-brutal mb-3 text-acid">{t.eyebrow}</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">{t.heading}</h1>
  <p class="card-brutal mb-6 border-acid font-mono text-sm text-paper">
    {t.warmupTip}
  </p>
  <InstallPrompt client:load variant="banner" />
  <WorkoutLogger client:load activities={activities} plans={plans} t={t} />
</BaseLayout>
```

- [ ] **Step 3: Leer `WorkoutLogger.tsx` y `ActivityPicker.tsx` completos**, extraer sus strings de UI (labels de sets/reps/peso, botones de agregar/guardar, mensajes de éxito/error, placeholder de búsqueda de ejercicio, etc. — sin tocar nombres de ejercicios/rutinas que vienen de `activities`/`plans`) y agregarlos como más claves dentro del mismo namespace `registrar` en ambos diccionarios

- [ ] **Step 4: Reemplazar esos strings en `WorkoutLogger.tsx` (recibe `t` como prop nueva) y en `ActivityPicker.tsx`** (recibe `t` como prop, pasado desde `WorkoutLogger`)

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run build`

Con Playwright: loguearse, ir a `/SelfGains/registro/nuevo/`, confirmar visualmente el chrome traducido y que los nombres de ejercicios siguen en español (esperado, no es un bug).

- [ ] **Step 6: Commit**

```bash
git add src/pages/registro/ src/components/react/WorkoutLogger/ src/components/react/ActivityPicker/ src/i18n/
git commit -m "feat: traducir la pantalla de Registrar entrenamiento"
```

---

## Tarea 13: Traducción — Progreso (`progreso/index.astro` + grupo `ProgressList`)

**Files en alcance:**
- Modify: `src/pages/progreso/index.astro`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`
- Modify: `src/components/react/ProgressList/CardioPRGrid.tsx`
- Modify: `src/components/react/ProgressList/CardioProgressChart.tsx`
- Modify: `src/components/react/ProgressList/DisciplineSummary.tsx`
- Modify: `src/components/react/ProgressList/MeasurementsChart.tsx`
- Modify: `src/components/react/ProgressList/MeasurementsSummary.tsx`
- Modify: `src/components/react/ProgressList/PRGrid.tsx`
- Modify: `src/components/react/ProgressList/ProgressChart.tsx`
- Modify: `src/components/react/ProgressList/WorkoutHistory.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `progreso`, con sub-claves por componente (`progreso.cardioPr`, `progreso.measurementsChart`, etc.) dado el volumen — es el grupo de archivos más grande del plan (9 archivos). Es la pantalla con más textos numéricos/estadísticos (unidades, ejes de gráfico, resúmenes) — prestar atención a strings dentro de tooltips y ejes de charts, que suelen estar en funciones auxiliares separadas del JSX principal, no solo en el `return`.

- [ ] **Step 1: Leer los 9 archivos completos**

- [ ] **Step 2: Agregar el namespace `progreso` a ambos diccionarios**, organizado en sub-objetos por componente

- [ ] **Step 3: Reemplazar strings en los 9 archivos**, pasando `t` (o la sub-porción que corresponda a cada componente) desde `progreso/index.astro` hacia abajo por la cadena de componentes

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

Con Playwright: loguearse (con datos de progreso cargados si hay una cuenta de prueba con historial), ir a `/SelfGains/progreso/`, confirmar visualmente cada sub-sección (PRs, cardio, medidas, historial) en inglés al cambiar el idioma.

- [ ] **Step 5: Commit**

```bash
git add src/pages/progreso/ src/components/react/ProgressList/ src/i18n/
git commit -m "feat: traducir la pantalla de Progreso"
```

---

## Tarea 14: Traducción — Conexiones (`conexiones.astro` + grupo `Connections`)

**Files en alcance:**
- Modify: `src/pages/conexiones.astro`
- Modify: `src/components/react/Connections/Connections.tsx`
- Modify: `src/components/react/Connections/IncomingRequests.tsx`
- Modify: `src/components/react/Connections/InviteLinkCard.tsx`
- Modify: `src/components/react/Connections/MyConnectionsList.tsx`
- Modify: `src/components/react/Connections/PendingRoutineShares.tsx`
- Modify: `src/components/react/Connections/RedeemCodeForm.tsx`
- Modify: `src/components/react/Connections/RedeemInvite.tsx`
- Modify: `src/components/react/Connections/TrainerSearch.tsx`
- Modify: `src/components/react/Connections/UserSearch.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `conexiones`, con sub-claves por componente. 9 archivos — mismo volumen que Progreso. Prestar atención especial a `TrainerSearch.tsx` (usa `MapPicker`, con textos de mapa/ubicación) y a los mensajes de estado de solicitudes (pendiente/aceptada/rechazada), que suelen tener 3+ variantes de texto por estado.

- [ ] **Step 1: Leer los 9 archivos completos**

- [ ] **Step 2: Agregar el namespace `conexiones` a ambos diccionarios**, organizado en sub-objetos por componente

- [ ] **Step 3: Reemplazar strings en los 9 archivos**, pasando `t` desde `conexiones.astro` hacia cada componente

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

Con Playwright: ir a `/SelfGains/conexiones/` logueado, confirmar visualmente el chrome traducido en cada sub-sección (buscar entrenador, mis conexiones, solicitudes, canjear código).

- [ ] **Step 5: Commit**

```bash
git add src/pages/conexiones.astro src/components/react/Connections/ src/i18n/
git commit -m "feat: traducir la pantalla de Conexiones"
```

---

## Tarea 15: Traducción — resto (sincronización, invitación, sync banner, install prompt, componentes compartidos)

**Files en alcance:**
- Modify: `src/pages/sincronizacion.astro`
- Modify: `src/pages/c.astro`
- Modify: `src/components/react/SyncBanner/SyncBanner.tsx`
- Modify: `src/components/react/SyncBanner/ConflictResolution.tsx`
- Modify: `src/components/react/InstallPrompt/InstallPrompt.tsx`
- Modify: `src/components/react/Shared/Avatar.tsx`
- Modify: `src/components/react/Shared/CollapsibleSection.tsx`
- Modify: `src/components/react/Shared/MapPicker.tsx`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`

**Namespace:** `sync` para sincronización/conflictos/invitación/instalación, más `common` para strings verdaderamente compartidos entre componentes `Shared/*` (ej. si `CollapsibleSection` tiene un "Ver más"/"Ver menos" genérico, o `MapPicker` un placeholder de búsqueda reutilizado en más de un lugar — solo crear `common` si hay strings genuinamente repetidos entre 2+ de estos archivos, si no cada uno usa su propia sub-clave dentro de `sync`).

Ojo: `SyncBanner.tsx` ya se importa e instancia directo en `BaseLayout.astro` (`<SyncBanner client:load />`, sin pasarle props hoy) — para que reciba `t`, hay que agregarle un prop nuevo en `SyncBanner.tsx` y pasárselo desde `BaseLayout.astro`, lo cual implica que `BaseLayout.astro` (ya tocado en la Tarea 4) también calcule `getDictionary(locale).sync` y se lo pase. Confirmar que la Tarea 4 no rompe con este cambio adicional — son ediciones en zonas distintas del mismo archivo (Tarea 4 toca `<head>`/`<html>`, esta tarea toca el `<body>` donde vive `<Nav />`/`<SyncBanner />`), no deberían pisarse, pero conviene revisar el diff completo de `BaseLayout.astro` al final de esta tarea para confirmarlo.

- [ ] **Step 1: Leer los 8 archivos completos**

- [ ] **Step 2: Agregar el namespace `sync` (y `common` si aplica) a ambos diccionarios**

- [ ] **Step 3: Reemplazar strings**, incluyendo el cambio en `BaseLayout.astro` para pasarle `t` a `SyncBanner`

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/pages/sincronizacion.astro src/pages/c.astro src/components/react/SyncBanner/ src/components/react/InstallPrompt/ src/components/react/Shared/ src/layouts/BaseLayout.astro src/i18n/
git commit -m "feat: traducir sincronización, invitación, sync banner, install prompt y componentes compartidos"
```

---

## Tarea 16: Páginas espejo en inglés (`src/pages/en/*.astro`)

**Files:**
- Create: `src/pages/en/index.astro`
- Create: `src/pages/en/login.astro`
- Create: `src/pages/en/registro-cuenta.astro`
- Create: `src/pages/en/olvide-contrasena.astro`
- Create: `src/pages/en/restablecer-contrasena.astro`
- Create: `src/pages/en/perfil.astro`
- Create: `src/pages/en/ejercicios/index.astro`
- Create: `src/pages/en/rutinas/index.astro`
- Create: `src/pages/en/registro/nuevo.astro`
- Create: `src/pages/en/progreso/index.astro`
- Create: `src/pages/en/sincronizacion.astro`
- Create: `src/pages/en/conexiones.astro`
- Create: `src/pages/en/c.astro`

Como cada página ya calcula su propio `locale`/`t` a partir de `Astro.currentLocale` (Tareas 7–15), y Astro deriva `currentLocale` automáticamente de la carpeta de ruteo (`src/pages/en/...` → `en`), cada espejo es una copia **literal, byte-por-byte**, del archivo en español correspondiente — sin editar ni una línea. Esto es intencional y es la razón por la que las Tareas 7–15 pasaron por leer `Astro.currentLocale` en vez de recibir el locale como prop o asumirlo fijo.

- [ ] **Step 1: Crear la copia — ejemplo con `index.astro`**

```bash
mkdir -p src/pages/en
cp src/pages/index.astro src/pages/en/index.astro
```

- [ ] **Step 2: Repetir para los 12 archivos restantes**, preservando la estructura de subcarpetas (`ejercicios/index.astro`, `rutinas/index.astro`, `registro/nuevo.astro`, `progreso/index.astro` viven en subcarpetas también dentro de `en/`):

```bash
mkdir -p src/pages/en/ejercicios src/pages/en/rutinas src/pages/en/registro
cp src/pages/login.astro src/pages/en/login.astro
cp src/pages/registro-cuenta.astro src/pages/en/registro-cuenta.astro
cp src/pages/olvide-contrasena.astro src/pages/en/olvide-contrasena.astro
cp src/pages/restablecer-contrasena.astro src/pages/en/restablecer-contrasena.astro
cp src/pages/perfil.astro src/pages/en/perfil.astro
cp src/pages/ejercicios/index.astro src/pages/en/ejercicios/index.astro
cp src/pages/rutinas/index.astro src/pages/en/rutinas/index.astro
cp src/pages/registro/nuevo.astro src/pages/en/registro/nuevo.astro
cp src/pages/progreso/index.astro src/pages/en/progreso/index.astro
cp src/pages/sincronizacion.astro src/pages/en/sincronizacion.astro
cp src/pages/conexiones.astro src/pages/en/conexiones.astro
cp src/pages/c.astro src/pages/en/c.astro
```

- [ ] **Step 3: Revisar imports relativos**

Cada archivo copiado a `src/pages/en/<mismo-nombre>.astro` (nivel raíz) o `src/pages/en/<carpeta>/<archivo>.astro` mantiene la MISMA profundidad relativa a `src/` que su original (`src/pages/en/index.astro` está a la misma profundidad que `src/pages/index.astro`; `src/pages/en/ejercicios/index.astro` a la misma que `src/pages/ejercicios/index.astro`), así que los imports relativos (`../layouts/BaseLayout.astro`, `../../i18n`, etc.) no necesitan tocarse — es exactamente por esto que se preservó la misma estructura de subcarpetas dentro de `en/`. Confirmar esto con un build, no asumirlo.

- [ ] **Step 4: Verificar con build + tsc**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios, y el output de `npm run build` debe listar las 13 rutas nuevas bajo `dist/en/...` (revisar el log del build, Astro lista cada página generada).

- [ ] **Step 5: Verificar con Playwright**

Navegar cada una de las 13 rutas bajo `/SelfGains/en/...` y confirmar que carga (sin 404) y que el `<html lang="en">` y el texto visible están en inglés (nav, título de página, headings principales). No hace falta un recorrido exhaustivo de cada formulario acá — eso es la Tarea 17.

- [ ] **Step 6: Commit**

```bash
git add src/pages/en/
git commit -m "feat: crear páginas espejo en inglés bajo /en/"
```

---

## Tarea 17: Verificación final + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build + tipos limpios de punta a punta**

Run: `npm run build && npx tsc --noEmit`
Expected: ambos limpios, cero errores.

- [ ] **Step 2: Grep final de strings sueltos**

Correr sobre TODO `src/pages`, `src/components`, `src/layouts` buscando patrones de español común que deberían haber desaparecido del código de UI (no del contenido):

```bash
grep -rn "class=\"label-brutal\"" src/pages src/components/astro --include="*.astro" -A1 | grep -v "{t\." 
```

(Ajustar el patrón según lo que se encuentre — el objetivo es una pasada de sanity check, no una prueba exhaustiva automatizada; el proyecto no tiene suite de tests por convención.)

- [ ] **Step 3: Recorrido visual completo con Playwright (skill `superpowers:webapp-testing`)**

Con `npx astro preview` sobre un build de producción:
- Navegar el sitio completo bajo `/SelfGains/en/` (las 13 páginas), confirmando texto en inglés en nav, botones, formularios, y mensajes de error simulados (ej. login con contraseña incorrecta).
- Cambiar de idioma desde el toggle del Nav (ES→EN y EN→ES) desde 2-3 pantallas distintas, confirmando que aterriza en la pantalla equivalente, no en el home.
- Cambiar de idioma desde Perfil, confirmar que coincide con lo que muestra el Nav después.
- Recargar la página después de elegir inglés, confirmar que la preferencia persiste (localStorage).
- Cerrar sesión y volver a iniciar sesión, confirmar que la preferencia de idioma persiste vía Supabase (`profiles.locale`) en un dispositivo/contexto de browser distinto (limpiar localStorage antes de loguearse de nuevo, confirmar que igual carga en el idioma guardado en el perfil).
- Confirmar que el contenido de ejercicios (nombres, instrucciones) sigue en español en ambos idiomas — **comportamiento esperado de esta ronda, no un bug a corregir.**

- [ ] **Step 4: Actualizar `README.md`**

Agregar un bullet a la lista de "Estado del proyecto" (mismo formato que las entradas existentes de temas ya shippeados como el reskin de UI o las imágenes de ejercicios), describiendo brevemente: app bilingüe ES/EN, ruteo `/en/`, selector en Nav y Perfil, detección de idioma en la primera visita, contenido de ejercicios/rutinas pendiente para una ronda futura.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: documentar la app bilingüe ES/EN en el estado del proyecto"
```

- [ ] **Step 6: Dispatch de un reviewer final holístico sobre todo el diff del branch antes de mergear** (paso de coordinación, no de código — lo ejecuta quien dirige subagent-driven-development, no un subagente más; ver skill `superpowers:subagent-driven-development`, "Dispatch final code reviewer subagent for entire implementation")
