import { useState } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';

export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
}

interface ExerciseOption {
  id: string;
  name: string;
}

interface RoutineListProps {
  title: string;
  source: 'predefined' | 'custom';
  routines: RoutineOption[];
  exercises: ExerciseOption[];
  emptyMessage: string;
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}

function daysSummary(days: RoutineDays, exercises: ExerciseOption[]): string {
  return WEEKDAYS.filter((day) => days[day].length > 0)
    .map((day) => {
      const names = days[day].map((id) => exercises.find((ex) => ex.id === id)?.name ?? id);
      return `${weekdayLabel(day)}: ${names.join(', ')}`;
    })
    .join(' · ');
}

function RoutineCard({
  routine,
  source,
  exercises,
  onActivate,
}: {
  routine: RoutineOption;
  source: 'predefined' | 'custom';
  exercises: ExerciseOption[];
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}) {
  const [weeks, setWeeks] = useState('8');

  return (
    <div className="card-brutal flex flex-col gap-3">
      <div>
        <p className="font-display text-2xl text-paper">{routine.name}</p>
        {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
      </div>
      <p className="font-mono text-sm text-paper-dim">{daysSummary(routine.days, exercises)}</p>
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
  exercises,
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
              exercises={exercises}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
