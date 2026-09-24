import test from 'node:test';
import assert from 'node:assert/strict';
import { muscleLabel } from '../src/lib/muscles.ts';

test('sin labels, devuelve el label en español', () => {
  assert.equal(muscleLabel('pecho'), 'Pecho');
});

test('un id desconocido se devuelve tal cual', () => {
  assert.equal(muscleLabel('Otros'), 'Otros');
});

test('con labels, usa la traducción', () => {
  assert.equal(muscleLabel('pecho', { pecho: 'Chest' }), 'Chest');
});

test('si a los labels les falta el id, cae al español y luego al id', () => {
  assert.equal(muscleLabel('gluteos', { pecho: 'Chest' }), 'Glúteos');
  assert.equal(muscleLabel('zzz', { pecho: 'Chest' }), 'zzz');
});
