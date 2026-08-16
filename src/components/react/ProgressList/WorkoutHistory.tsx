import { useState } from 'react';
import {
  deleteSession,
  deleteSet,
  deleteWorkout,
  updateSession,
  updateSet,
} from '../../../lib/workouts';
import { DISCIPLINE_COLORS, fullActivityName, kmToMeters, requiresDistance } from '../../../lib/activities';
import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import {
  parseSessionInput,
  parseSetInput,
  SessionFields,
  SetFields,
} from '../WorkoutLogger/WorkoutLogger';
import type { WorkoutSession, WorkoutSet } from '../../../types/db';
import type { WorkoutWithSessions, WorkoutWithSets } from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

interface Props {
  workouts: WorkoutWithLogs[];
  exerciseNames: Record<string, string>;
  activities: ActivityOption[];
  onChanged: () => void;
  filterDiscipline?: string | null;
}

function SetRow({
  set,
  exerciseName,
  onChanged,
}: {
  set: WorkoutSet;
  exerciseName: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(String(set.weight));
  const [rpe, setRpe] = useState(set.rpe !== null ? String(set.rpe) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = parseSetInput(reps, weight, rpe);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSet(set.id, parsed.reps, parsed.weight, parsed.rpe ?? undefined);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta serie?')) return;
    try {
      await deleteSet(set.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la serie.');
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <span className="font-body text-paper">
          {exerciseName} — serie {set.set_number}
        </span>
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
        />
        {error && <p className="font-mono text-xs text-blood">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-brutal-sm">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-brutal-sm opacity-60"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2">
      <span className="font-body text-paper">{exerciseName}</span>
      <span className="text-paper-dim">
        — serie {set.set_number}: {set.reps} reps x {set.weight} kg
        {set.rpe !== null ? ` (RPE ${set.rpe})` : ''}
      </span>
      <span className="ml-auto flex gap-3 font-mono text-xs">
        <button type="button" onClick={() => setEditing(true)} className="text-acid hover:text-paper">
          Editar
        </button>
        <button type="button" onClick={handleDelete} className="text-blood hover:text-paper">
          Eliminar
        </button>
      </span>
    </li>
  );
}

function SessionRow({
  session,
  activityName,
  activity,
  onChanged,
}: {
  session: WorkoutSession;
  activityName: string;
  activity: ActivityOption | undefined;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState(String(session.duration_min));
  const [distance, setDistance] = useState(
    session.distance_km !== null ? String(kmToMeters(session.distance_km)) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsDistance = activity ? requiresDistance(activity) : session.distance_km !== null;

  async function handleSave() {
    const parsed = parseSessionInput(duration, distance, needsDistance);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSession(session.id, parsed.durationMin, parsed.distanceKm ?? undefined);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta sesión?')) return;
    try {
      await deleteSession(session.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la sesión.');
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <span className="font-body text-paper">{activityName}</span>
        <SessionFields
          duration={duration}
          distance={distance}
          requiresDistance={needsDistance}
          onDurationChange={setDuration}
          onDistanceChange={setDistance}
        />
        {error && <p className="font-mono text-xs text-blood">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-brutal-sm">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-brutal-sm opacity-60"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2">
      <span className="font-body text-paper">{activityName}</span>
      <span className="text-paper-dim">
        — {session.distance_km !== null ? `${kmToMeters(session.distance_km)} m en ` : ''}
        {session.duration_min} min
      </span>
      <span className="ml-auto flex gap-3 font-mono text-xs">
        <button type="button" onClick={() => setEditing(true)} className="text-acid hover:text-paper">
          Editar
        </button>
        <button type="button" onClick={handleDelete} className="text-blood hover:text-paper">
          Eliminar
        </button>
      </span>
    </li>
  );
}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

function DisciplineTags({ disciplines }: { disciplines: string[] }) {
  if (disciplines.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {disciplines.map((d) => (
        <span
          key={d}
          style={{ backgroundColor: DISCIPLINE_COLORS[d] ?? 'var(--color-paper-dim)' }}
          className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-on-accent"
        >
          {LABEL_BY_DISCIPLINE[d] ?? d}
        </span>
      ))}
    </div>
  );
}

export default function WorkoutHistory({
  workouts,
  exerciseNames,
  activities,
  onChanged,
  filterDiscipline,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const activityById = new Map(activities.map((a) => [a.id, a]));

  function disciplinesForWorkout(w: WorkoutWithLogs): string[] {
    const found = new Set<string>();
    if (w.sets.length > 0) found.add('gym');
    for (const s of w.sessions) {
      const discipline = activityById.get(s.activity_id)?.discipline;
      if (discipline) found.add(discipline);
    }
    return DISCIPLINES.map((d) => d.id).filter((id) => found.has(id));
  }

  const visibleWorkouts = filterDiscipline
    ? workouts.filter((w) => disciplinesForWorkout(w).includes(filterDiscipline))
    : workouts;

  async function handleDeleteWorkout(workoutId: string) {
    if (!confirm('¿Eliminar todo el entrenamiento de este día? Esta acción no se puede deshacer.')) {
      return;
    }
    setError(null);
    try {
      await deleteWorkout(workoutId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el entrenamiento.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {visibleWorkouts.length === 0 && (
        <p className="font-mono text-sm text-paper-dim">
          No hay entrenamientos de esta disciplina todavía.
        </p>
      )}
      {visibleWorkouts.map((w) => (
        <div key={w.id} className="card-brutal">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl tracking-wide text-acid">{w.date}</h2>
              <DisciplineTags disciplines={disciplinesForWorkout(w)} />
            </div>
            <button
              type="button"
              onClick={() => handleDeleteWorkout(w.id)}
              className="font-mono text-xs text-blood hover:text-paper"
            >
              Eliminar día
            </button>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-paper-dim/20 font-mono text-sm">
            {w.sets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                exerciseName={exerciseNames[s.exercise_id] ?? s.exercise_id}
                onChanged={onChanged}
              />
            ))}
            {w.sessions.map((s) => {
              const activity = activityById.get(s.activity_id);
              return (
                <SessionRow
                  key={s.id}
                  session={s}
                  activityName={activity ? fullActivityName(activity) : s.activity_id}
                  activity={activity}
                  onChanged={onChanged}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
