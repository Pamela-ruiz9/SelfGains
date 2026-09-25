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
