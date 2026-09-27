import test from 'node:test';
import assert from 'node:assert/strict';
import { weightTrend, topDiscipline } from '../src/lib/prs.ts';

test('weightTrend: sin mediciones de peso devuelve null', () => {
  assert.equal(weightTrend([]), null);
  assert.equal(weightTrend([{ date: '2026-09-01', weight_kg: null }]), null);
});

test('weightTrend: una sola medición devuelve null (no hay línea base distinta)', () => {
  const result = weightTrend([{ date: '2026-09-01', weight_kg: 80 }]);
  assert.equal(result, null);
});

test('weightTrend: baja de peso da un delta negativo', () => {
  // 2026-08-05 -> 2026-09-01 son 27 días, dentro de la ventana de 28 días
  // (si fuera más vieja que la ventana, quedaría fuera y no habría base
  // distinta de la última medición — ver el siguiente test).
  const result = weightTrend([
    { date: '2026-08-05', weight_kg: 80 },
    { date: '2026-09-01', weight_kg: 78.5 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, -1.5);
});

test('weightTrend: sube de peso da un delta positivo', () => {
  const result = weightTrend([
    { date: '2026-08-05', weight_kg: 78.5 },
    { date: '2026-09-01', weight_kg: 80 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, 1.5);
});

test('weightTrend: única medición previa cae fuera de la ventana de 4 semanas -> null', () => {
  // 31 días de diferencia: el único punto anterior a la última medición
  // queda excluido de "los últimos 28 días", así que no hay línea base
  // distinta de la propia última medición.
  const result = weightTrend([
    { date: '2026-08-01', weight_kg: 80 },
    { date: '2026-09-01', weight_kg: 78.5 },
  ]);
  assert.equal(result, null);
});

test('weightTrend: ignora una línea base a menos de 4 semanas (usa la más antigua dentro de la ventana)', () => {
  const result = weightTrend([
    { date: '2026-08-25', weight_kg: 79 },
    { date: '2026-08-28', weight_kg: 79.5 },
    { date: '2026-09-01', weight_kg: 80 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, 1);
});

test('weightTrend: línea base a exactamente 28 días cuenta como dentro de la ventana', () => {
  // 2026-08-04 -> 2026-09-01 son exactamente 28 días (límite inclusivo:
  // `>=`, no `>`).
  const result = weightTrend([
    { date: '2026-08-04', weight_kg: 80 },
    { date: '2026-09-01', weight_kg: 78.5 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, -1.5);
});

test('weightTrend: funciona igual si las mediciones llegan desordenadas', () => {
  const result = weightTrend([
    { date: '2026-09-01', weight_kg: 80 },
    { date: '2026-08-05', weight_kg: 78.5 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, 1.5);
});

test('topDiscipline: lista vacía devuelve null', () => {
  assert.equal(topDiscipline([]), null);
});

test('topDiscipline: devuelve la disciplina con más sesiones', () => {
  const result = topDiscipline([
    { discipline: 'gym', sessionCount: 2, totalMinutes: null, setCount: 10 },
    { discipline: 'running', sessionCount: 5, totalMinutes: 120, setCount: null },
  ]);
  assert.equal(result?.discipline, 'running');
});

test('topDiscipline: en un empate gana la primera entrada de la lista', () => {
  const result = topDiscipline([
    { discipline: 'gym', sessionCount: 3, totalMinutes: null, setCount: 10 },
    { discipline: 'running', sessionCount: 3, totalMinutes: 90, setCount: null },
  ]);
  assert.equal(result?.discipline, 'gym');
});
