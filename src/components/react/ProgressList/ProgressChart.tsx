import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProgressPoint } from '../../../lib/prs';

interface ExerciseInfo {
  id: string;
  name: string;
}

interface Props {
  exerciseId: string;
  points: ProgressPoint[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper-dim">{label}</p>
      <p className="text-acid">{payload[0].value} kg</p>
    </div>
  );
}

export default function ProgressChart({ exerciseId, points, exercises, onSelectExercise }: Props) {
  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Ejercicio</span>
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
            <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                unit=" kg"
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="maxWeight"
                stroke="var(--color-acid)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--color-acid)' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
