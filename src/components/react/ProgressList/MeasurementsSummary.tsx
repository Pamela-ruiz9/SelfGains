import type { Measurement } from '../../../types/db';

export const MEASUREMENT_DISPLAY_FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'height_cm', label: 'Estatura', unit: 'cm' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'hip_cm', label: 'Cadera', unit: 'cm' },
  { key: 'arm_cm', label: 'Brazo', unit: 'cm' },
  { key: 'leg_cm', label: 'Pierna', unit: 'cm' },
];

interface Props {
  latest: Measurement | null;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export default function MeasurementsSummary({ latest, selected, onSelect }: Props) {
  if (!latest) return null;
  const available = MEASUREMENT_DISPLAY_FIELDS.filter(({ key }) => latest[key] !== null);
  if (available.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Tus medidas</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {available.map(({ key, label, unit }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(selected === key ? null : key)}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === key ? 'border-acid' : ''
            }`}
          >
            <span className="label-brutal">{label}</span>
            <span className="font-display text-2xl text-paper">
              {latest[key]} <span className="text-sm text-paper-dim">{unit}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
