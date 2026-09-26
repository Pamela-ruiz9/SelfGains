export interface BodyCompositionInput {
  sex: 'femenino' | 'masculino' | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  heightCm: number | null;
}

// Método Navy (US Navy circumference method). Requiere cuello+cintura+altura
// siempre, y además cadera si es mujer. Si falta cualquier dato requerido,
// devuelve null en vez de inventar un número — ver
// docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md
// sección 2.1 sobre por qué se descartaron fórmulas menos confiables
// (BMI+edad) para esto.
export function estimateBodyFatPercent(input: BodyCompositionInput): number | null {
  const { sex, neckCm, waistCm, hipCm, heightCm } = input;
  if (!sex || neckCm === null || waistCm === null || heightCm === null) return null;
  if (waistCm <= neckCm) return null; // circunferencias no fisiológicas — no calcular

  if (sex === 'masculino') {
    const pct =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
    return Math.round(pct * 10) / 10;
  }

  if (hipCm === null) return null;
  if (waistCm + hipCm <= neckCm) return null;
  const pct =
    495 /
      (1.29579 -
        0.35004 * Math.log10(waistCm + hipCm - neckCm) +
        0.221 * Math.log10(heightCm)) -
    450;
  return Math.round(pct * 10) / 10;
}

// Sustituto de "% músculo" (no existe fórmula confiable por circunferencias
// sin bioimpedancia/DEXA): masa magra en kg = peso × (1 − %grasa/100).
// Incluye músculo + hueso + órganos, no es "% músculo puro".
export function estimateLeanMassKg(weightKg: number, bodyFatPercent: number | null): number | null {
  if (bodyFatPercent === null) return null;
  return Math.round(weightKg * (1 - bodyFatPercent / 100) * 10) / 10;
}
