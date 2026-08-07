import { useState } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
}

interface RoutineListProps {
  title: string;
  source: 'predefined' | 'custom';
  routines: RoutineOption[];
  activities: ActivityOption[];
  emptyMessage: string;
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}

function daysSummary(days: RoutineDays, activities: ActivityOption[]): string {
  return WEEKDAYS.filter((day) => days[day].length > 0)
    .map((day) => {
      const names = days[day].map((id) => activities.find((a) => a.id === id)?.name ?? id);
      return `${weekdayLabel(day)}: ${names.join(', ')}`;
    })
    .join(' · ');
}

function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
}: {
  routine: RoutineOption;
  source: 'predefined' | 'custom';
  activities: ActivityOption[];
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}) {
  const [weeks, setWeeks] = useState('8');

  return (
    <div className="card-brutal flex flex-col gap-3">
      <div>
        <p className="font-display text-2xl text-paper">{routine.name}</p>
        {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
      </div>
      <p className="font-mono text-sm text-paper-dim">{daysSummary(routine.days, activities)}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={weeks}
          onChange={(e) => setWeeks(e.target.value)}
          min={1}
          className="input-brutal w-20"
        />
        <span className="label-brutal">semanas</span>
        <button
          type="button"
          onClick={() => onActivate(source, routine.ref, Number(weeks))}
          className="btn-brutal-sm ml-auto"
        >
          Activar
        </button>
      </div>
    </div>
  );
}

export default function RoutineList({
  title,
  source,
  routines,
  activities,
  emptyMessage,
  onActivate,
}: RoutineListProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{title}</p>
      {routines.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.ref}
              routine={routine}
              source={source}
              activities={activities}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
