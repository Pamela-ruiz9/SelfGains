import type { Measurement } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../../../lib/bodyComposition';

type MeasurementFieldLabelKey = keyof Dictionary['progreso']['measurementsSummary']['fields'];

// Sin estatura a propósito: no cambia para un adulto, así que no tiene
// sentido como tarjeta de progreso en el tiempo — sigue existiendo como
// campo en Perfil, solo se saca de acá.
// `labelKey` (not a hardcoded label) so both this component and
// ProgressList — which needs the label too, for MeasurementsChart — can
// resolve the translated text from whichever locale's `t` they were
// handed, instead of duplicating the copy.
export const MEASUREMENT_DISPLAY_FIELDS: {
  key: keyof Measurement;
  labelKey: MeasurementFieldLabelKey;
  unit: string;
}[] = [
  { key: 'weight_kg', labelKey: 'weight', unit: 'kg' },
  { key: 'waist_cm', labelKey: 'waist', unit: 'cm' },
  { key: 'hip_cm', labelKey: 'hip', unit: 'cm' },
  { key: 'neck_cm', labelKey: 'neck', unit: 'cm' },
  { key: 'arm_cm', labelKey: 'arm', unit: 'cm' },
  { key: 'leg_cm', labelKey: 'leg', unit: 'cm' },
];

interface Props {
  latest: Measurement | null;
  sex: 'femenino' | 'masculino' | null;
  selected: string | null;
  onSelect: (key: string | null) => void;
  t: Dictionary['progreso']['measurementsSummary'];
}

export default function MeasurementsSummary({ latest, sex, selected, onSelect, t }: Props) {
  if (!latest) return null;
  const available = MEASUREMENT_DISPLAY_FIELDS.filter(({ key }) => latest[key] !== null);

  const bodyFatPercent = estimateBodyFatPercent({
    sex,
    neckCm: latest.neck_cm,
    waistCm: latest.waist_cm,
    hipCm: latest.hip_cm,
    heightCm: latest.height_cm,
  });
  const leanMassKg =
    latest.weight_kg !== null ? estimateLeanMassKg(latest.weight_kg, bodyFatPercent) : null;

  if (available.length === 0 && bodyFatPercent === null) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {available.map(({ key, labelKey, unit }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(selected === key ? null : key)}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === key ? 'border-acid' : ''
            }`}
          >
            <span className="label-brutal">{t.fields[labelKey]}</span>
            <span className="font-display text-2xl text-paper">
              {latest[key]} <span className="text-sm text-paper-dim">{unit}</span>
            </span>
          </button>
        ))}
        {bodyFatPercent !== null && (
          <button
            type="button"
            onClick={() => onSelect(selected === 'body_fat_percent' ? null : 'body_fat_percent')}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === 'body_fat_percent' ? 'border-acid' : ''
            }`}
          >
            <span className="label-brutal">{t.fields.bodyFat}</span>
            <span className="font-display text-2xl text-paper">
              {bodyFatPercent} <span className="text-sm text-paper-dim">%</span>
            </span>
          </button>
        )}
        {leanMassKg !== null && (
          <div className="card-brutal flex flex-col gap-1">
            <span className="label-brutal">{t.fields.leanMass}</span>
            <span className="font-display text-2xl text-paper">
              {leanMassKg} <span className="text-sm text-paper-dim">kg</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
