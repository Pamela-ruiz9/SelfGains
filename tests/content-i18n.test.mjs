import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeActivity, localizePlan } from '../src/lib/content-i18n.ts';

const vocab = {
  equipment: { Máquina: 'Machine', Barra: 'Barbell' },
  planLevels: { Principiante: 'Beginner' },
  groups: { crol: 'Freestyle' },
};
const vocabEs = {
  equipment: { Máquina: 'Máquina', Barra: 'Barra' },
  planLevels: { Principiante: 'Principiante' },
  groups: { crol: 'Crol' },
};

const gymEntry = {
  id: 'abductor-maquina',
  body: '  Sentado en la máquina.  \n',
  data: {
    name: 'Abductor en máquina',
    name_en: 'Machine hip abduction',
    instructions_en: 'Seated in the machine.',
    discipline: 'gym',
    metricType: 'sets',
    muscles: ['gluteos'],
    equipment: 'Máquina',
    image: 'abductor-maquina.webp',
  },
};

const swimEntry = {
  id: 'natacion-crol-catch-up',
  body: 'Nada con un brazo adelante.',
  data: {
    name: 'Catch-up',
    name_en: 'Catch-up drill',
    instructions_en: 'Swim with one arm extended.',
    discipline: 'natacion',
    metricType: 'session',
    group: 'crol',
  },
};

test('actividad en español: nombre y cuerpo originales, cuerpo sin espacios sobrantes', () => {
  const a = localizeActivity(gymEntry, 'es', vocabEs);
  assert.equal(a.name, 'Abductor en máquina');
  assert.equal(a.description, 'Sentado en la máquina.');
  assert.equal(a.equipment, 'Máquina');
});

test('actividad en inglés: name_en, instructions_en y equipamiento traducido', () => {
  const a = localizeActivity(gymEntry, 'en', vocab);
  assert.equal(a.name, 'Machine hip abduction');
  assert.equal(a.description, 'Seated in the machine.');
  assert.equal(a.equipment, 'Machine');
  assert.equal(a.image, 'abductor-maquina.webp');
  assert.deepEqual(a.muscles, ['gluteos']);
});

test('el id, la disciplina y el metricType no cambian con el idioma', () => {
  const es = localizeActivity(gymEntry, 'es', vocabEs);
  const en = localizeActivity(gymEntry, 'en', vocab);
  for (const k of ['id', 'discipline', 'metricType']) assert.equal(es[k], en[k]);
});

test('el grupo se conserva como clave y groupLabel se traduce', () => {
  const en = localizeActivity(swimEntry, 'en', vocab);
  assert.equal(en.group, 'crol');
  assert.equal(en.groupLabel, 'Freestyle');
  const es = localizeActivity(swimEntry, 'es', vocabEs);
  assert.equal(es.groupLabel, 'Crol');
});

test('una actividad sin grupo ni equipamiento no inventa labels', () => {
  const a = localizeActivity(
    { id: 'x', body: '', data: { ...swimEntry.data, group: undefined } },
    'en',
    vocab
  );
  assert.equal(a.groupLabel, undefined);
  assert.equal(a.equipment, undefined);
});

test('un equipamiento desconocido se devuelve tal cual', () => {
  const a = localizeActivity(
    { ...gymEntry, data: { ...gymEntry.data, equipment: 'Kettlebell' } },
    'en',
    vocab
  );
  assert.equal(a.equipment, 'Kettlebell');
});

const planEntry = {
  id: 'full-body',
  data: {
    name: 'Full body',
    name_en: 'Full body split',
    goal: 'Fuerza general',
    goal_en: 'General strength',
    level: 'Principiante',
    sex: 'femenino',
    days: { lunes: ['a'] },
  },
};

test('plan en español: goal original y level como clave; levelLabel en español', () => {
  const p = localizePlan(planEntry, 'es', vocabEs);
  assert.equal(p.name, 'Full body');
  assert.equal(p.goal, 'Fuerza general');
  assert.equal(p.level, 'Principiante');
  assert.equal(p.levelLabel, 'Principiante');
});

test('plan en inglés: name_en, goal_en y levelLabel traducidos, level sigue siendo la clave en español', () => {
  const p = localizePlan(planEntry, 'en', vocab);
  assert.equal(p.name, 'Full body split');
  assert.equal(p.goal, 'General strength');
  assert.equal(p.level, 'Principiante');
  assert.equal(p.levelLabel, 'Beginner');
  assert.equal(p.sex, 'femenino');
  assert.deepEqual(p.days, { lunes: ['a'] });
});
