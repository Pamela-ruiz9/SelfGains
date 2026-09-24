import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { es } from '../src/i18n/es.ts';
import { en } from '../src/i18n/en.ts';
import { MUSCLES } from '../src/lib/muscles.ts';

const CONTENT = new URL('../src/content/', import.meta.url).pathname;

// "<id>:<campo>" de valores que son legítimamente iguales en español e inglés
// (ej. un nombre como "Burpees"). Agregar acá solo tras confirmarlo a mano.
const SAME_OK = new Set([
  'face-pull:name_en',
  'hip-thrust:name_en',
  'natacion-crol-catch-up:name_en',
  'natacion-crol-fingertip-drag:name_en',
  'natacion-crol-sculling:name_en',
  'natacion-crol-zipper:name_en',
  'natacion-dorso-catch-up:name_en',
  'natacion-mariposa-catch-up:name_en',
  'natacion-pecho-catch-up:name_en',
  'full-body:name_en',
  'push-pull-legs:name_en',
  'running-base:name_en',
]);

function load(collection) {
  const dir = join(CONTENT, collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      assert.ok(m, `${collection}/${f}: sin frontmatter`);
      return { id: f.slice(0, -3), data: yaml.load(m[1]), body: m[2].trim() };
    });
}

const activities = load('activities');
const plans = load('plans');

function assertTranslated(id, field, en, es_) {
  assert.equal(typeof en, 'string', `${id}: falta ${field}`);
  assert.ok(en.trim().length > 0, `${id}: ${field} vacío`);
  if (!SAME_OK.has(`${id}:${field}`)) {
    assert.notEqual(en.trim(), es_.trim(), `${id}: ${field} es idéntico al español (¿sin traducir?)`);
  }
}

test('se leyó contenido de ambas colecciones', () => {
  assert.ok(activities.length > 0);
  assert.ok(plans.length > 0);
});

test('toda actividad tiene name_en e instructions_en traducidos', () => {
  for (const a of activities) {
    assertTranslated(a.id, 'name_en', a.data.name_en, a.data.name);
    assertTranslated(a.id, 'instructions_en', a.data.instructions_en, a.body);
  }
});

test('todo plan tiene name_en y goal_en traducidos', () => {
  for (const p of plans) {
    assertTranslated(p.id, 'name_en', p.data.name_en, p.data.name);
    assertTranslated(p.id, 'goal_en', p.data.goal_en, p.data.goal);
  }
});

test('todo equipment usado tiene traducción en es y en', () => {
  for (const a of activities.filter((x) => x.data.equipment)) {
    assert.ok(a.data.equipment in es.equipment, `${a.id}: equipment "${a.data.equipment}" falta en es.equipment`);
    assert.ok(a.data.equipment in en.equipment, `${a.id}: equipment "${a.data.equipment}" falta en en.equipment`);
  }
});

test('todo level de plan y group de actividad tiene traducción', () => {
  for (const p of plans) {
    assert.ok(p.data.level in en.planLevels, `${p.id}: level "${p.data.level}" falta en planLevels`);
  }
  for (const a of activities.filter((x) => x.data.group)) {
    assert.ok(a.data.group in en.groups, `${a.id}: group "${a.data.group}" falta en groups`);
  }
});

test('todos los músculos del modelo (y "Otros") tienen label en es y en', () => {
  for (const m of [...MUSCLES.map((x) => x.id), 'Otros']) {
    assert.ok(m in es.muscles, `es.muscles sin ${m}`);
    assert.ok(m in en.muscles, `en.muscles sin ${m}`);
  }
});
