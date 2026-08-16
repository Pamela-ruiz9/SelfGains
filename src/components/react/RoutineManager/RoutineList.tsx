import { useState } from 'react';
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
  onEdit?: (ref: string) => void;
  onDelete?: (ref: string) => void;
}

function daysSummary(days: RoutineDays, activities: ActivityOption[]): string {
  return WEEKDAYS.filter((day) => days[day].length > 0)
    .map((day) => {
      const names = days[day].map((entry) => {
        const id = entryActivityId(entry);
        const activity = activities.find((a) => a.id === id);
        const label = activity ? fullActivityName(activity) : id;
        const summary = activity ? targetSummary(activity.metricType, entryTarget(entry)) : null;
        return summary ? `${label} (${summary})` : label;
      });
      return `${weekdayLabel(day)}: ${names.join(', ')}`;
    })
    .join(' · ');
}

function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
  onEdit,
  onDelete,
}: {
  routine: RoutineOption;
  source: 'predefined' | 'custom';
  activities: ActivityOption[];
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
  onEdit?: (ref: string) => void;
  onDelete?: (ref: string) => void;
}) {
  const [weeks, setWeeks] = useState('8');

  return (
    <div className="card-brutal flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-paper">{routine.name}</p>
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
        </div>
        {source === 'custom' && (
          <div className="flex shrink-0 gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => onEdit?.(routine.ref)}
              className="text-acid hover:text-paper"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(routine.ref)}
              className="text-blood hover:text-paper"
            >
              Eliminar
            </button>
          </div>
        )}
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
  onEdit,
  onDelete,
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
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
