import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import { es } from '../../../i18n/es';
import type { Dictionary } from '../../../i18n/es';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface RoutinePreviewProps {
  days: RoutineDays;
  activities: ActivityOption[];
  // Optional: PendingRoutineShares (Connections) renders this without a
  // locale yet, so it falls back to Spanish there until that screen gets
  // its own translation pass.
  t?: Pick<Dictionary['rutinas'], 'preview' | 'days'>;
}

export default function RoutinePreview({ days, activities, t = es.rutinas }: RoutinePreviewProps) {
  const scheduledDays = WEEKDAYS.filter((day) => days[day].length > 0);

  if (scheduledDays.length === 0) {
    return <p className="font-mono text-xs text-paper-dim">{t.preview.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2 border-l border-paper-dim/40 pl-3">
      {scheduledDays.map((day) => (
        <div key={day}>
          <p className="label-brutal">{t.days[day]}</p>
          <ul className="font-mono text-xs text-paper-dim">
            {days[day].map((entry, i) => {
              const id = entryActivityId(entry);
              const activity = activities.find((a) => a.id === id);
              const label = activity ? fullActivityName(activity) : id;
              const summary = activity ? targetSummary(activity.metricType, entryTarget(entry)) : null;
              return <li key={i}>{summary ? `${label} (${summary})` : label}</li>;
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
