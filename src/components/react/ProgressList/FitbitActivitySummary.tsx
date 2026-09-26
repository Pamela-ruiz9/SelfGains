import type { FitbitDailyData } from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  data: FitbitDailyData;
  t: Dictionary['progreso']['fitbitActivity'];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-brutal flex flex-col gap-1">
      <span className="label-brutal">{label}</span>
      <span className="font-display text-xl text-paper">{value}</span>
    </div>
  );
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
      {data.steps !== null && <Tile label={t.steps} value={data.steps.toLocaleString()} />}
      {data.restingHeartRate !== null && (
        <Tile label={t.restingHeartRate} value={`${data.restingHeartRate} bpm`} />
      )}
      {data.caloriesOut !== null && <Tile label={t.calories} value={`${data.caloriesOut} kcal`} />}
      {data.activeMinutes !== null && (
        <Tile label={t.activeMinutes} value={formatMinutes(data.activeMinutes)} />
      )}
      {data.sleepMinutes !== null && <Tile label={t.sleep} value={formatMinutes(data.sleepMinutes)} />}
    </div>
  );
}
