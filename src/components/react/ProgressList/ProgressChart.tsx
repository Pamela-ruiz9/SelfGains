import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
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

function ChartTooltip({
  active,
  payload,
  label,
  weightUnit,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
  weightUnit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper-dim">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value} {weightUnit}
        </p>
      ))}
    </div>
  );
}

export default function ProgressChart({ exerciseId, points, exercises, onSelectExercise, t }: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const displayPoints = points.map((p) => ({
    ...p,
    maxWeight: kgToDisplay(p.maxWeight, weightUnit),
    estimated1RM: kgToDisplay(p.estimated1RM, weightUnit),
    volume: kgToDisplay(p.volume, weightUnit),
  }));

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
        <p className="mb-4 font-display text-2xl text-paper">{exerciseName}</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                yAxisId="weight"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                unit={` ${weightUnit}`}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                unit={` ${weightUnit}`}
              />
              <Tooltip content={<ChartTooltip weightUnit={weightUnit} />} />
              <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
              <Bar
                yAxisId="volume"
                dataKey="volume"
                name={t.volume}
                fill="var(--color-paper-dim)"
                fillOpacity={0.35}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="maxWeight"
                name={t.maxWeight}
                stroke="var(--color-acid)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--color-acid)' }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="estimated1RM"
                name={t.estimated1RM}
                stroke="var(--color-blood)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 4, fill: 'var(--color-blood)' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
