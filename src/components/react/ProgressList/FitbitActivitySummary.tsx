import type { FitbitDailyData } from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { FootstepsIcon, HeartIcon, FlameIcon, TimerIcon, MoonIcon, GLOW_PALETTE } from '../../../lib/progressIcons';

interface Props {
  data: FitbitDailyData;
  t: Dictionary['progreso']['fitbitActivity'];
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FitbitActivitySummary({ data, t }: Props) {
  const hasAnyData =
    data.steps !== null ||
    data.restingHeartRate !== null ||
    data.caloriesOut !== null ||
    data.activeMinutes !== null ||
    data.sleepMinutes !== null;

  if (!hasAnyData) {
    return <p className="font-mono text-sm text-paper-dim">{t.empty}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.steps !== null && (
        <GlowTile
          icon={<FootstepsIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[0]}
          label={t.steps}
          value={data.steps.toLocaleString()}
        />
      )}
      {data.restingHeartRate !== null && (
        <GlowTile
          icon={<HeartIcon className="h-5 w-5" />}
          color="var(--color-blood)"
          label={t.restingHeartRate}
          value={`${data.restingHeartRate} bpm`}
        />
      )}
      {data.caloriesOut !== null && (
        <GlowTile
          icon={<FlameIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[3]}
          label={t.calories}
          value={`${Math.round(data.caloriesOut)} kcal`}
        />
      )}
      {data.activeMinutes !== null && (
        <GlowTile
          icon={<TimerIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[1]}
          label={t.activeMinutes}
          value={formatMinutes(Math.round(data.activeMinutes))}
        />
      )}
      {data.sleepMinutes !== null && (
        <GlowTile
          icon={<MoonIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[2]}
          label={t.sleep}
          value={formatMinutes(data.sleepMinutes)}
        />
      )}
    </div>
  );
}
