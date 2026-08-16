import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MeasurementPoint } from '../../../lib/prs';

interface Props {
  label: string;
  unit: string;
  points: MeasurementPoint[];
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper-dim">{label}</p>
      <p className="text-acid">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

export default function MeasurementsChart({ label, unit, points }: Props) {
  return (
    <div className="card-brutal">
      <p className="mb-4 font-display text-2xl text-paper">{label}</p>
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
              unit={` ${unit}`}
            />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-acid)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--color-acid)' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
