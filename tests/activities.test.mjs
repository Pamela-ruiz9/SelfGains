import test from 'node:test';
import assert from 'node:assert/strict';
import { fullActivityName } from '../src/lib/activities.ts';

test('sin grupo, devuelve solo el nombre', () => {
  assert.equal(fullActivityName({ name: 'Press banca' }), 'Press banca');
});

test('con grupo sin groupLabel, usa la etiqueta en español', () => {
  assert.equal(fullActivityName({ name: 'Catch-up', group: 'crol' }), 'Crol — Catch-up');
});

test('con groupLabel traducido, lo usa en lugar de la etiqueta en español', () => {
  assert.equal(
    fullActivityName({ name: 'Catch-up', group: 'crol', groupLabel: 'Freestyle' }),
    'Freestyle — Catch-up'
  );
});
