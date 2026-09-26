import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../src/lib/bodyComposition.ts';

test('estimateBodyFatPercent: hombre, datos completos', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: 38,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.ok(pct !== null);
  assert.ok(pct > 10 && pct < 25, `esperaba un % plausible, salió ${pct}`);
});

test('estimateBodyFatPercent: mujer, datos completos (usa cadera)', () => {
  const pct = estimateBodyFatPercent({
    sex: 'femenino',
    neckCm: 32,
    waistCm: 75,
    hipCm: 98,
    heightCm: 165,
  });
  assert.ok(pct !== null);
  assert.ok(pct > 10 && pct < 35, `esperaba un % plausible, salió ${pct}`);
});

test('estimateBodyFatPercent: mujer sin cadera devuelve null (falta un dato requerido)', () => {
  const pct = estimateBodyFatPercent({
    sex: 'femenino',
    neckCm: 32,
    waistCm: 75,
    hipCm: null,
    heightCm: 165,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: sin sexo definido devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: null,
    neckCm: 38,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: falta cuello devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: null,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateLeanMassKg: peso × (1 − %grasa/100)', () => {
  assert.equal(estimateLeanMassKg(80, 20), 64);
  assert.equal(estimateLeanMassKg(60, 25), 45);
});

test('estimateLeanMassKg: %grasa null devuelve null', () => {
  assert.equal(estimateLeanMassKg(80, null), null);
});

test('estimateBodyFatPercent: falta cintura devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: 38,
    waistCm: null,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: falta altura devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: 38,
    waistCm: 85,
    hipCm: null,
    heightCm: null,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: hombre con cintura <= cuello (no fisiológico) devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: 38,
    waistCm: 30,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: mujer con cintura + cadera <= cuello (no fisiológico) devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'femenino',
    neckCm: 45,
    waistCm: 20,
    hipCm: 20,
    heightCm: 165,
  });
  assert.equal(pct, null);
});
