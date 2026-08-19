export type WeightUnit = 'kg' | 'lb';

const WEIGHT_UNIT_STORAGE_KEY = 'selfgains-weight-unit';
const KG_PER_LB = 0.45359237;

// Preference only, device-local like the theme/accent — the weight of a
// logged set is always stored/summed in kg (DB column, PR math), this only
// controls what unit it's shown/typed in.
export function getWeightUnit(): WeightUnit {
  if (typeof window === 'undefined') return 'kg';
  try {
    return localStorage.getItem(WEIGHT_UNIT_STORAGE_KEY) === 'lb' ? 'lb' : 'kg';
  } catch {
    return 'kg';
  }
}

export function setWeightUnit(unit: WeightUnit): void {
  try {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, unit);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // the preference just won't persist past this page load.
  }
}

// Rounds to 1 decimal so conversions don't show long floats (e.g. 100 kg ->
// 220.5 lb, not 220.46226...).
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}
