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
