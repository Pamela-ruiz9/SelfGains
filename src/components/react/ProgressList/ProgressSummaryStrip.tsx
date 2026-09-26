import AdherenceRing from './AdherenceRing';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  daysTrained: number;
  daysElapsed: number;
  lastWeightKg: number | null;
  weightUnit: 'kg' | 'lb';
  kgToDisplay: (kg: number, unit: 'kg' | 'lb') => number;
  recentPRLabel: string | null; // "Sentadilla — 92 kg" ya armado por el caller
  totalWorkouts: number;
  disciplineCount: number;
  bodyFatPercent: number | null;
  t: Dictionary['progreso']['summary'];
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-brutal flex flex-col gap-1">
      <span className="label-brutal">{label}</span>
      <span className="font-display text-xl text-paper">{value}</span>
    </div>
  );
}

export default function ProgressSummaryStrip({
  daysTrained,
  daysElapsed,
  lastWeightKg,
  weightUnit,
  kgToDisplay,
  recentPRLabel,
  totalWorkouts,
  disciplineCount,
  bodyFatPercent,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <AdherenceRing daysTrained={daysTrained} daysElapsed={daysElapsed} label={t.adherenceLabel} />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {lastWeightKg !== null && (
          <Tile label={t.lastWeight} value={`${kgToDisplay(lastWeightKg, weightUnit)} ${weightUnit}`} />
        )}
        {recentPRLabel !== null && <Tile label={t.recentPR} value={recentPRLabel} />}
        {totalWorkouts > 0 && <Tile label={t.totalWorkouts} value={String(totalWorkouts)} />}
        {disciplineCount > 0 && <Tile label={t.disciplines} value={String(disciplineCount)} />}
        {bodyFatPercent !== null && <Tile label={t.bodyFat} value={`${bodyFatPercent} %`} />}
      </div>
    </div>
  );
}
