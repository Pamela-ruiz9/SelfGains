# Cierre bilingüe: PWA en inglés, tests en el CI y una errata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La PWA instalada desde `/en/` usa un manifest en inglés, el service worker precachea la home en inglés, el CI corre `npm test` antes de desplegar, y se corrige la errata `mantendiendo`.

**Architecture:** Dos manifests estáticos en `public/` con el mismo `id`; `BaseLayout.astro` enlaza el que corresponde al locale; `public/sw.js` amplía su precache y sube de versión; un test estático (`tests/pwa.test.mjs`) fija todo eso sin necesitar build. Verificación final contra `dist/` y un navegador real.

**Tech Stack:** Astro 5 (static), service worker vanilla, GitHub Actions, `node --test` (tests con js-yaml, ya devDependency).

**Spec:** `docs/superpowers/specs/2026-09-24-pwa-en-ci-cierre-design.md`

## Convenciones de todo el plan

- **Commits:** cada commit termina con el trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (segundo `-m`); `git add` solo de rutas explícitas, nunca `git add -A`.
- **Verificación estándar** ("verificación estándar"): `npm test` sin fallos; `npx tsc --noEmit` muestra **solo** el error preexistente de `src/components/react/ProgressList/ProgressList.tsx` (`Measurement[]` no asignable, ~línea 197); `npm run build` termina con `Complete!` y 26 páginas.
- **Ejecutar en un worktree** `cierre-bilingue` creado desde el `HEAD` local (el spec y el plan están commiteados en `main` pero sin pushear): `git worktree add -b cierre-bilingue .claude/worktrees/cierre-bilingue HEAD`, y entrar con `EnterWorktree` usando `path`. No hace falta `npm install` (no hay dependencias nuevas): enlazar `node_modules` con `ln -s /home/pamer/projects/SelfGains/node_modules .claude/worktrees/cierre-bilingue/node_modules`. **No correr `npm install` dentro del worktree** (reemplazaría el enlace por una copia).
- **Nunca correr dos builds a la vez** en el mismo worktree (chocan al limpiar `dist/`).
- **Comandos git en el worktree:** simples, sin `cd` al repo principal ni `$(...)` complejos (el entorno aislado los rechaza).

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `tests/pwa.test.mjs` | Crear | Fija manifests, service worker, enlace del layout y paso del CI |
| `public/manifest.webmanifest` | Modificar | Agregar `id` |
| `public/manifest.en.webmanifest` | Crear | Manifest en inglés |
| `src/layouts/BaseLayout.astro` | Modificar | Enlazar el manifest según locale |
| `public/sw.js` | Modificar | Precache de `/en/` y del manifest en inglés; versión v2 |
| `.github/workflows/deploy.yml` | Modificar | Paso `npm test` antes del build |
| `src/content/activities/natacion-crol-fingertip-drag.md` | Modificar | Errata en el cuerpo en español |

---

### Task 1: Manifests con `id` compartido (TDD)

**Files:**
- Create: `tests/pwa.test.mjs`
- Modify: `public/manifest.webmanifest`
- Create: `public/manifest.en.webmanifest`

- [ ] **Step 1: Escribir los tests que fallan**

`tests/pwa.test.mjs` (los tests de las Tasks 2 y 3 se agregan a este mismo archivo más adelante):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(path(p), 'utf8');
const manifest = (p) => JSON.parse(read(p));

test('ambos manifests comparten un id explícito', () => {
  const es = manifest('public/manifest.webmanifest');
  const en = manifest('public/manifest.en.webmanifest');
  assert.equal(es.id, '/SelfGains/');
  assert.equal(en.id, es.id);
});

test('el manifest en inglés solo difiere en lang, description y start_url', () => {
  const es = manifest('public/manifest.webmanifest');
  const en = manifest('public/manifest.en.webmanifest');
  const neutral = (m) => ({ ...m, lang: '', description: '', start_url: '' });
  assert.deepEqual(neutral(en), neutral(es));
  assert.equal(en.lang, 'en');
  assert.equal(en.start_url, '/SelfGains/en/');
  assert.notEqual(en.description, es.description);
  assert.doesNotMatch(en.description, /[áéíóúñ¿¡]/i);
});

test('el start_url de cada manifest queda dentro de su scope', () => {
  for (const file of ['public/manifest.webmanifest', 'public/manifest.en.webmanifest']) {
    const m = manifest(file);
    assert.ok(m.start_url.startsWith(m.scope), `${file}: start_url fuera del scope`);
  }
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test`
Expected: los 3 tests nuevos FALLAN (`ENOENT ... manifest.en.webmanifest` en los dos primeros; el tercero también, por el mismo archivo). Los 28 anteriores siguen pasando.

- [ ] **Step 3: Agregar `id` al manifest en español**

En `public/manifest.webmanifest`, agregar la línea `"id": "/SelfGains/",` justo después de `"name"`/`"short_name"`, antes de `"description"`:

```json
{
  "name": "SelfGains",
  "short_name": "SelfGains",
  "id": "/SelfGains/",
  "description": "Registro de entrenamientos, rutinas y progreso — gym, running, natación y combate.",
```
(el resto del archivo no cambia).

- [ ] **Step 4: Crear el manifest en inglés**

`public/manifest.en.webmanifest`:

```json
{
  "name": "SelfGains",
  "short_name": "SelfGains",
  "id": "/SelfGains/",
  "description": "Log workouts, routines and progress — gym, running, swimming and combat sports.",
  "lang": "en",
  "start_url": "/SelfGains/en/",
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

- [ ] **Step 5: Verificar que pasa**

Run: `npm test`
Expected: 31 tests, 31 pasan, 0 fallan.

- [ ] **Step 6: Commit**

```bash
git add tests/pwa.test.mjs public/manifest.webmanifest public/manifest.en.webmanifest
git commit -m "feat(pwa): manifest en inglés y id compartido entre manifests" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Enlace del layout y service worker (TDD)

**Files:**
- Modify: `tests/pwa.test.mjs` (agregar al final)
- Modify: `src/layouts/BaseLayout.astro:24`
- Modify: `public/sw.js:4-6`

- [ ] **Step 1: Agregar los tests que fallan**

Al final de `tests/pwa.test.mjs`:

```js
function swShell() {
  const src = read('public/sw.js');
  const array = src.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(array, 'no se encontró const SHELL en sw.js');
  return [...array[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('el service worker precachea la home y el manifest en inglés', () => {
  const shell = swShell();
  assert.ok(shell.includes('/SelfGains/en/'));
  assert.ok(shell.includes('/SelfGains/manifest.en.webmanifest'));
  // lo que ya precacheaba sigue ahí
  for (const url of ['/SelfGains/', '/SelfGains/favicon.svg', '/SelfGains/manifest.webmanifest']) {
    assert.ok(shell.includes(url), `falta ${url}`);
  }
});

test('la versión de la caché subió respecto a v1 (para que el worker viejo se descarte)', () => {
  const version = read('public/sw.js').match(/const VERSION = '([^']+)'/)[1];
  assert.notEqual(version, 'selfgains-shell-v1');
  assert.match(version, /^selfgains-shell-v\d+$/);
});

test('cada URL del precache existe como archivo público o página de Astro (cache.addAll es atómico)', () => {
  for (const url of swShell()) {
    const rel = url.replace(/^\/SelfGains\//, '');
    const candidates = rel === '' ? ['src/pages/index.astro'] : rel === 'en/'
      ? ['src/pages/en/index.astro']
      : [`public/${rel}`];
    assert.ok(candidates.some((c) => existsSync(path(c))), `${url} no existe (${candidates.join(' | ')})`);
  }
});

test('BaseLayout enlaza el manifest en inglés para el locale en y el de español para el resto', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const link = layout.match(/<link rel="manifest"[^>]*\/>/);
  assert.ok(link, 'no se encontró el <link rel="manifest">');
  assert.match(link[0], /locale === 'en'/);
  assert.match(link[0], /manifest\.en\.webmanifest/);
  assert.match(link[0], /manifest\.webmanifest/);
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test`
Expected: FALLAN los tests 1, 2 y 4 nuevos (no está `/SelfGains/en/` en el `SHELL`; la versión sigue en `v1`; el layout no menciona `manifest.en.webmanifest`). El test 3 puede pasar todavía (las URLs actuales existen). Los 31 anteriores pasan.

- [ ] **Step 3: Cambiar el enlace del layout**

En `src/layouts/BaseLayout.astro` (línea 24), reemplazar

```astro
    <link rel="manifest" href={`${base}manifest.webmanifest`} />
```

por

```astro
    <link rel="manifest" href={`${base}${locale === 'en' ? 'manifest.en.webmanifest' : 'manifest.webmanifest'}`} />
```

(`locale` ya está definido en el frontmatter del layout como `'en' | 'es'`.)

- [ ] **Step 4: Actualizar el service worker**

En `public/sw.js`, reemplazar las líneas 4-6:

```js
const VERSION = 'selfgains-shell-v1';

const SHELL = ['/SelfGains/', '/SelfGains/favicon.svg', '/SelfGains/manifest.webmanifest'];
```

por:

```js
const VERSION = 'selfgains-shell-v2';

const SHELL = [
  '/SelfGains/',
  '/SelfGains/en/',
  '/SelfGains/favicon.svg',
  '/SelfGains/manifest.webmanifest',
  '/SelfGains/manifest.en.webmanifest',
];
```

No tocar nada más del archivo.

- [ ] **Step 5: Verificar que pasa**

Run: `npm test`
Expected: 35 tests, 35 pasan, 0 fallan. Si el test "cada URL del precache existe" falla por `src/pages/index.astro`, comprobar con `ls src/pages/index.astro src/pages/en/index.astro` y ajustar solo la ruta candidata del test (no el `SHELL`).

- [ ] **Step 6: Verificación estándar**

Run: `npx tsc --noEmit && npm run build`
Expected: verificación estándar (solo el error preexistente de `ProgressList.tsx`; 26 páginas).

- [ ] **Step 7: Commit**

```bash
git add tests/pwa.test.mjs src/layouts/BaseLayout.astro public/sw.js
git commit -m "feat(pwa): enlazar el manifest por locale y precachear la home en inglés (caché v2)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `npm test` en el CI (TDD)

**Files:**
- Modify: `tests/pwa.test.mjs` (agregar al final)
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Agregar el test que falla**

Al final de `tests/pwa.test.mjs`, agregar el import de js-yaml junto a los otros imports (arriba del archivo: `import yaml from 'js-yaml';`) y este test:

```js
test('el CI corre npm test después de npm ci y antes del build', () => {
  const wf = yaml.load(read('.github/workflows/deploy.yml'));
  const runs = wf.jobs.build.steps.map((s) => s.run).filter(Boolean);
  const ci = runs.indexOf('npm ci');
  const test_ = runs.indexOf('npm test');
  const build = runs.indexOf('npm run build');
  assert.ok(ci >= 0 && build >= 0, 'faltan npm ci / npm run build');
  assert.ok(test_ > ci && test_ < build, `npm test debe ir entre npm ci y npm run build (orden: ${runs.join(' → ')})`);
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test`
Expected: el test nuevo FALLA (`npm test debe ir entre npm ci y npm run build`). Los 35 anteriores pasan.

- [ ] **Step 3: Agregar el paso al workflow**

En `.github/workflows/deploy.yml`, en el job `build`, entre `- run: npm ci` y el paso `- run: npm run build`, agregar:

```yaml
      - run: npm test
```

de modo que quede:

```yaml
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test`
Expected: 36 tests, 36 pasan, 0 fallan.

- [ ] **Step 5: Commit**

```bash
git add tests/pwa.test.mjs .github/workflows/deploy.yml
git commit -m "ci: correr npm test antes del build de despliegue" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Errata en el contenido en español

**Files:**
- Modify: `src/content/activities/natacion-crol-fingertip-drag.md:10`

- [ ] **Step 1: Confirmar el estado actual**

Run: `grep -rn "mantendiendo" src`
Expected: exactamente una coincidencia, en `src/content/activities/natacion-crol-fingertip-drag.md:10` (el cuerpo en español; `instructions_en` no la tiene).

- [ ] **Step 2: Corregir la palabra**

En esa línea reemplazar `mantendiendo` por `manteniendo` (solo esa palabra; no tocar el resto de la línea ni ningún otro archivo).

- [ ] **Step 3: Verificar**

Run: `grep -rn "mantendiendo" src; git diff --stat`
Expected: el grep no imprime nada; el diff muestra 1 archivo, 1 inserción y 1 borrado. Luego `npm test` (36 pasan) y `npm run build` (26 páginas, `Complete!`).

- [ ] **Step 4: Commit**

```bash
git add src/content/activities/natacion-crol-fingertip-drag.md
git commit -m "fix(content): errata «mantendiendo» → «manteniendo» en natacion-crol-fingertip-drag" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Verificación contra el build y un navegador real

No modifica archivos del repo y no commitea. Los scripts y capturas van al directorio scratchpad de la sesión.

- [ ] **Step 1: Build y comprobaciones sobre `dist/`**

Run: `npm run build` y luego este script (guardarlo en el scratchpad como `check-dist.mjs` y ejecutarlo con `node` desde la raíz del worktree):

```js
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmls = walk('dist').filter((f) => f.endsWith('.html'));
let bad = 0;
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  const link = html.match(/<link rel="manifest" href="([^"]+)"/);
  if (!link) { console.log('SIN MANIFEST', f); continue; }
  const isEn = f.startsWith('dist/en/');
  const expected = isEn ? '/SelfGains/manifest.en.webmanifest' : '/SelfGains/manifest.webmanifest';
  if (link[1] !== expected) { bad++; console.log('MAL', f, link[1], 'esperado', expected); }
}
const es = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
const en = JSON.parse(readFileSync('dist/manifest.en.webmanifest', 'utf8'));
console.log('html revisados:', htmls.length, 'enlaces incorrectos:', bad);
console.log('ids:', es.id, en.id, '| en.lang:', en.lang, '| en.start_url:', en.start_url);
for (const u of ['/SelfGains/', '/SelfGains/en/', '/SelfGains/favicon.svg', '/SelfGains/manifest.webmanifest', '/SelfGains/manifest.en.webmanifest']) {
  const rel = u.replace('/SelfGains/', '');
  const file = rel === '' ? 'dist/index.html' : rel.endsWith('/') ? `dist/${rel}index.html` : `dist/${rel}`;
  console.log(existsSync(file) ? 'OK ' : 'FALTA', u, '->', file);
}
```
Expected: `enlaces incorrectos: 0`, los dos `id` iguales a `/SelfGains/`, `en.lang: en`, `en.start_url: /SelfGains/en/`, y las 5 URLs del precache con `OK`.

- [ ] **Step 2: Service worker en un navegador real (Playwright)**

Cargar la skill `webapp-testing` para el manejo de Playwright. Levantar `npx astro preview --host 127.0.0.1 --port 4321` en segundo plano (base `/SelfGains/`) y, con un contexto de Chromium headless con `locale: 'es-ES'` y `serviceWorkers: 'allow'`:
1. Ir primero a `http://127.0.0.1:4321/SelfGains/favicon.svg` (archivo sin service worker) y desde `page.evaluate` crear una caché vieja: `caches.open('selfgains-shell-v1').then(c => c.put('/x', new Response('viejo')))`.
2. Ir a `http://127.0.0.1:4321/SelfGains/` y esperar a que el service worker quede activo (`navigator.serviceWorker.ready`, más una pausa de ~1 s para el `activate`).
3. Verificar con `caches.keys()` que existe `selfgains-shell-v2`, que **no** existe `selfgains-shell-v1`, y con `caches.open('selfgains-shell-v2').then(c => c.keys())` que contiene las 5 URLs del `SHELL` (`/SelfGains/`, `/SelfGains/en/`, `/SelfGains/favicon.svg`, `/SelfGains/manifest.webmanifest`, `/SelfGains/manifest.en.webmanifest`).
4. En una página `/SelfGains/en/ejercicios/`, `document.querySelector('link[rel=manifest]').href` termina en `manifest.en.webmanifest`; en `/SelfGains/ejercicios/` (contexto con `locale: 'es-ES'`), en `manifest.webmanifest`.
5. Con el service worker ya instalado, simular sin red (`context.setOffline(true)`) y recargar `/SelfGains/en/`: debe cargar desde la caché (título de página en inglés visible, sin error de red).
6. Recoger errores de consola y de página.

Reportar cada punto como ✅/❌ con la evidencia (las claves de caché, las URLs, el texto visto). **Siempre** detener el servidor `astro preview` al final (matar el proceso del puerto 4321) y confirmar que el puerto quedó libre. No modificar ni commitear nada.

- [ ] **Step 3: Verificación estándar y cierre**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 36 tests pasan; solo el error preexistente de `tsc`; 26 páginas. Luego seguir con `superpowers:finishing-a-development-branch`. Después del merge y del push, comprobar el primer despliegue con `gh run watch` (el CI ahora corre `npm test`; si falla en GitHub, corregir y reportar).
