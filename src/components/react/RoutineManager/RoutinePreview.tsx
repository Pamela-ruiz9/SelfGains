import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  weekdayLabel,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface RoutinePreviewProps {
  days: RoutineDays;
  activities: ActivityOption[];
}

export default function RoutinePreview({ days, activities }: RoutinePreviewProps) {
  const scheduledDays = WEEKDAYS.filter((day) => days[day].length > 0);

  if (scheduledDays.length === 0) {
    return <p className="font-mono text-xs text-paper-dim">Esta rutina no tiene días cargados.</p>;
  }

  return (
    <div className="flex flex-col gap-2 border-l-2 border-paper-dim/40 pl-3">
      {scheduledDays.map((day) => (
        <div key={day}>
          <p className="label-brutal">{weekdayLabel(day)}</p>
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
