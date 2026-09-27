import type { ComponentType } from 'react';
import type { Measurement } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../../../lib/bodyComposition';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, TapeMeasureIcon, DropletIcon, MuscleIcon, GLOW_PALETTE } from '../../../lib/progressIcons';

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

// El peso usa ScaleIcon; el resto de los campos de cinta métrica comparten
// TapeMeasureIcon — solo el color (GLOW_PALETTE, cíclico) los distingue.
// Tipado por las keys reales de MEASUREMENT_DISPLAY_FIELDS (no `string`
// suelto) para que TypeScript obligue a cubrir cualquier campo nuevo que se
// agregue ahí — de lo contrario un campo sin ícono compilaría igual y
// rompería el render en tiempo de ejecución.
type CircumferenceOrWeightKey = 'weight_kg' | 'waist_cm' | 'hip_cm' | 'neck_cm' | 'arm_cm' | 'leg_cm';

const FIELD_ICON: Record<CircumferenceOrWeightKey, ComponentType<{ className?: string }>> = {
  weight_kg: ScaleIcon,
  waist_cm: TapeMeasureIcon,
  hip_cm: TapeMeasureIcon,
  neck_cm: TapeMeasureIcon,
  arm_cm: TapeMeasureIcon,
  leg_cm: TapeMeasureIcon,
};

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
        {available.map(({ key, labelKey, unit }, index) => {
          // `key` viene tipado como `keyof Measurement` (MEASUREMENT_DISPLAY_FIELDS
          // no lo estrecha), pero en runtime siempre es uno de los 6 campos de
          // esa lista — el cast documenta esa garantía sin volver a ensanchar
          // el tipo de FIELD_ICON.
          const Icon = FIELD_ICON[key as CircumferenceOrWeightKey];
          return (
            <GlowTile
              key={key}
              icon={<Icon className="h-5 w-5" />}
              color={GLOW_PALETTE[index % GLOW_PALETTE.length]}
              label={t.fields[labelKey]}
              value={
                <>
                  {latest[key]} <span className="text-sm text-paper-dim">{unit}</span>
                </>
              }
              selected={selected === key}
              onClick={() => onSelect(selected === key ? null : key)}
            />
          );
        })}
        {bodyFatPercent !== null && (
          <GlowTile
            icon={<DropletIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[4]}
            label={t.fields.bodyFat}
            value={
              <>
                {bodyFatPercent} <span className="text-sm text-paper-dim">%</span>
              </>
            }
            selected={selected === 'body_fat_percent'}
            onClick={() => onSelect(selected === 'body_fat_percent' ? null : 'body_fat_percent')}
          />
        )}
        {leanMassKg !== null && (
          <GlowTile
            icon={<MuscleIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[2]}
            label={t.fields.leanMass}
            value={
              <>
                {leanMassKg} <span className="text-sm text-paper-dim">kg</span>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
