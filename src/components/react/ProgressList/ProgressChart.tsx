import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressPoint } from '../../../lib/prs';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { Dictionary } from '../../../i18n/es';

interface ExerciseInfo {
  id: string;
  name: string;
}

interface Props {
  exerciseId: string;
  points: ProgressPoint[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
  t: Dictionary['progreso']['progressChart'];
}

type Metric = 'maxWeight' | 'estimated1RM' | 'volume';

const METRIC_COLOR: Record<'maxWeight' | 'estimated1RM', string> = {
  maxWeight: 'var(--color-acid)',
  estimated1RM: 'var(--color-blood)',
};

function ChartTooltip({
  active,
  payload,
  label,
  weightUnit,
  metricLabel,
  format,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  weightUnit: string;
  metricLabel: string;
  format: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const text = format
    .replace('{metric}', metricLabel)
    .replace('{date}', label ?? '')
    .replace('{value}', `${payload[0].value} ${weightUnit}`);
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper">{text}</p>
    </div>
  );
}

export default function ProgressChart({ exerciseId, points, exercises, onSelectExercise, t }: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const [showInfo, setShowInfo] = useState(false);
  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;

  useEffect(() => {
    setShowInfo(false);
  }, [exerciseId]);

  const displayPoints = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        maxWeight: kgToDisplay(p.maxWeight, weightUnit),
        estimated1RM: kgToDisplay(p.estimated1RM, weightUnit),
        volume: kgToDisplay(p.volume, weightUnit),
      })),
    [points, weightUnit]
  );

  const maxIndex = displayPoints.reduce(
    (best, p, i) => (p[metric] > (displayPoints[best]?.[metric] ?? -Infinity) ? i : best),
    0
  );

  const trend = useMemo(() => {
    if (displayPoints.length === 0) return null;
    const latest = displayPoints[displayPoints.length - 1];
    const latestDate = new Date(latest.date);
    const fourWeeksAgo = new Date(latestDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const baseline = displayPoints.find((p) => new Date(p.date) >= fourWeeksAgo);
    if (!baseline || baseline.date === latest.date || baseline[metric] === 0) return null;
    const percent = Math.round(((latest[metric] - baseline[metric]) / baseline[metric]) * 1000) / 10;
    return percent;
  }, [displayPoints, metric]);

  const metricLabel = t[metric];
  const infoText = t.info[metric];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">{t.exerciseLabel}</span>
        <select
          value={exerciseId}
          onChange={(e) => onSelectExercise(e.target.value)}
          className="input-brutal"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>
      <div className="card-brutal">
        <div className="mb-1 flex items-center gap-2">
          <p className="font-display text-2xl text-paper">{exerciseName}</p>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Más información"
            aria-expanded={showInfo}
            className="group relative flex h-5 w-5 items-center justify-center rounded-full border border-paper-dim/60 text-xs text-paper-dim"
          >
            i
            {/* Tap toggles showInfo; hover/focus keep working via the CSS-only
                group-hover/group-focus-within variants layered alongside it. */}
            <div
              className={`pointer-events-none absolute left-0 top-6 z-10 w-60 rounded-control border border-paper-dim/40 bg-surface p-3 text-xs text-paper-dim shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                showInfo ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {infoText}
            </div>
          </button>
          {trend !== null && (
            <span className="ml-auto rounded-control border border-acid px-2 py-0.5 font-mono text-xs text-acid">
              {(trend >= 0 ? t.trendUp : t.trendDown).replace('{percent}', String(Math.abs(trend)))}
            </span>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['maxWeight', 'estimated1RM', 'volume'] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={m === metric ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm opacity-60'}
            >
              {t[m]}
            </button>
          ))}
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'volume' ? (
              <BarChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                  unit={` ${weightUnit}`}
                />
                <Tooltip
                  content={
                    <ChartTooltip weightUnit={weightUnit} metricLabel={metricLabel} format={t.tooltipPoint} />
                  }
                />
                <Bar dataKey="volume" fill="var(--color-acid)" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRIC_COLOR[metric]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={METRIC_COLOR[metric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                  unit={` ${weightUnit}`}
                />
                <Tooltip
                  content={
                    <ChartTooltip weightUnit={weightUnit} metricLabel={metricLabel} format={t.tooltipPoint} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="none"
                  fill={`url(#fill-${metric})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={METRIC_COLOR[metric]}
                  strokeWidth={2.5}
                  strokeDasharray={metric === 'estimated1RM' ? '6 5' : undefined}
                  style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, ${METRIC_COLOR[metric]} 60%, transparent))` }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const isPR = props.index === maxIndex;
                    return (
                      <g key={props.index}>
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isPR ? 7 : 4}
                          fill={isPR ? '#3fff8f' : METRIC_COLOR[metric]}
                        />
                        {isPR && (
                          <text
                            x={props.cx}
                            y={(props.cy ?? 0) - 14}
                            textAnchor="middle"
                            fontSize="10"
                            className="fill-paper-dim"
                          >
                            {t.prBadge}
                          </text>
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
