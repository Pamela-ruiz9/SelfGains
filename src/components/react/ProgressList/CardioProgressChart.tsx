import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPace, type CardioProgressPoint } from '../../../lib/prs';
import { fullActivityName } from '../../../lib/activities';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface Props {
  activityId: string;
  points: CardioProgressPoint[];
  activities: ActivityOption[];
  onSelectActivity: (id: string) => void;
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
      <p className="text-acid">{formatPace(payload[0].value)}</p>
    </div>
  );
}

export default function CardioProgressChart({
  activityId,
  points,
  activities,
  onSelectActivity,
}: Props) {
  const selected = activities.find((a) => a.id === activityId);
  const activityName = selected ? fullActivityName(selected) : activityId;
  const cardioActivities = activities.filter(
    (a) => a.metricType === 'session' && a.discipline !== 'combate'
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Actividad</span>
        <select
          value={activityId}
          onChange={(e) => onSelectActivity(e.target.value)}
          className="input-brutal"
        >
          {cardioActivities.map((a) => (
            <option key={a.id} value={a.id}>
              {fullActivityName(a)}
            </option>
          ))}
        </select>
      </label>
      <div className="card-brutal">
        <p className="mb-1 font-display text-2xl text-paper">{activityName}</p>
        <p className="mb-4 font-mono text-xs text-paper-dim">Ritmo — más abajo es más rápido</p>
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
                tickFormatter={(value: number) => formatPace(value)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="paceMinPerKm"
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
