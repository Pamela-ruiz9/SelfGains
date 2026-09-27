import AdherenceRing from './AdherenceRing';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, TrophyIcon, CalendarIcon, LayersIcon, DropletIcon, FootstepsIcon, GLOW_PALETTE } from '../../../lib/progressIcons';
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
  stepsToday: number | null;
  t: Dictionary['progreso']['summary'];
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
  stepsToday,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <AdherenceRing daysTrained={daysTrained} daysElapsed={daysElapsed} label={t.adherenceLabel} />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {lastWeightKg !== null && (
          <GlowTile
            icon={<ScaleIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[0]}
            label={t.lastWeight}
            value={`${kgToDisplay(lastWeightKg, weightUnit)} ${weightUnit}`}
          />
        )}
        {recentPRLabel !== null && (
          <GlowTile
            icon={<TrophyIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[2]}
            label={t.recentPR}
            value={recentPRLabel}
          />
        )}
        {totalWorkouts > 0 && (
          <GlowTile
            icon={<CalendarIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[1]}
            label={t.totalWorkouts}
            value={String(totalWorkouts)}
          />
        )}
        {disciplineCount > 0 && (
          <GlowTile
            icon={<LayersIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[3]}
            label={t.disciplines}
            value={String(disciplineCount)}
          />
        )}
        {bodyFatPercent !== null && (
          <GlowTile
            icon={<DropletIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[4]}
            label={t.bodyFat}
            value={`${bodyFatPercent} %`}
          />
        )}
        {stepsToday !== null && (
          <GlowTile
            icon={<FootstepsIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[0]}
            label={t.stepsToday}
            value={stepsToday.toLocaleString()}
          />
        )}
      </div>
    </div>
  );
}
